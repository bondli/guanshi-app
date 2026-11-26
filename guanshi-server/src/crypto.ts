import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config'

/**
 * 客户端只把 LLM Key 加密后随请求带上来，服务端不落库。
 * 用 RSA-OAEP(SHA-256) 加密，服务端私钥解密，明文只存在于本次请求内存里。
 */

const privateKeyPath = path.join(config.keyDir, 'server-private.pem')
const publicKeyPath = path.join(config.keyDir, 'server-public.pem')

function loadOrCreateKeys(): { privateKey: string; publicKey: string } {
  try {
    if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
      return {
        privateKey: fs.readFileSync(privateKeyPath, 'utf8'),
        publicKey: fs.readFileSync(publicKeyPath, 'utf8'),
      }
    }
    fs.mkdirSync(config.keyDir, { recursive: true })
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    })
    fs.writeFileSync(privateKeyPath, privateKey, { encoding: 'utf8', mode: 0o600 })
    fs.writeFileSync(publicKeyPath, publicKey, 'utf8')
    console.log(`[crypto] 已生成传输密钥：${publicKeyPath}`)
    return { privateKey, publicKey }
  } catch (error) {
    console.warn(`[crypto] 读写密钥失败，使用临时密钥：${(error as Error).message}`)
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    })
    return { privateKey, publicKey }
  }
}

const keys = loadOrCreateKeys()

export const publicKeyPem = keys.publicKey

/** 供客户端展示的密钥指纹，便于排查密钥是否换过 */
export const keyFingerprint = crypto
  .createHash('sha256')
  .update(keys.publicKey)
  .digest('hex')
  .slice(0, 16)

/** 解密客户端上送的密文；失败返回 null */
export function decryptSecret(cipherBase64: string): string | null {
  if (!cipherBase64 || typeof cipherBase64 !== 'string') return null
  try {
    const buffer = Buffer.from(cipherBase64, 'base64')
    const plain = crypto.privateDecrypt(
      {
        key: keys.privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      buffer,
    )
    return plain.toString('utf8')
  } catch (error) {
    console.warn(`[crypto] 解密失败：${(error as Error).message}`)
    return null
  }
}
