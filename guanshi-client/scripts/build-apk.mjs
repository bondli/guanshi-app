import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const android = path.join(root, 'android')

// Gradle 有时会把 JS bundle 任务判定为 up-to-date，导致改完代码打出来的还是旧包。
// 每次打包前清掉产物，强制重新 bundle。
for (const dir of [
  'app/build/generated/assets/react',
  'app/build/intermediates/assets/release',
  'app/build/intermediates/merged_assets',
]) {
  fs.rmSync(path.join(android, dir), { recursive: true, force: true })
}

// expo prebuild 会清掉 android 目录，local.properties 也跟着没了。
// 这里按常见位置补一份，避免每次 prebuild 后构建失败。
const localProperties = path.join(android, 'local.properties')
if (!fs.existsSync(localProperties)) {
  const sdk =
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    path.join(process.env.HOME || '', 'Library', 'Android', 'sdk')
  if (sdk && fs.existsSync(sdk)) {
    fs.writeFileSync(localProperties, `sdk.dir=${sdk}\n`)
  }
}

const javaHome = process.env.JAVA_HOME || '/opt/homebrew/opt/openjdk@17'
const gradle = spawnSync('./gradlew', ['assembleRelease', '--no-daemon'], {
  cwd: android,
  stdio: 'inherit',
  env: { ...process.env, JAVA_HOME: javaHome },
})
if (gradle.status !== 0) {
  console.error('Gradle 构建失败')
  process.exit(gradle.status ?? 1)
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const version = pkg.version || '0.0.0'
const outDir = path.join(root, 'dist')
fs.mkdirSync(outDir, { recursive: true })

function copy(file, name) {
  const target = path.join(outDir, name)
  fs.copyFileSync(file, target)
  const size = (fs.statSync(target).size / 1024 / 1024).toFixed(1)
  console.log(`已复制 APK：${target} (${size} MB)`)
}

// 按 ABI 拆包后是两个独立 APK：arm64 给真机，x86_64 给模拟器
const releaseDir = path.join(android, 'app/build/outputs/apk/release')
const splitApks = fs.existsSync(releaseDir)
  ? fs.readdirSync(releaseDir).filter((file) => file.endsWith('.apk'))
  : []
const arm64 = splitApks.find((file) => file.includes('arm64-v8a'))
const x86 = splitApks.find((file) => file.includes('x86_64'))

if (arm64) {
  copy(path.join(releaseDir, arm64), `guanshi-${version}.apk`)
  if (x86) copy(path.join(releaseDir, x86), `guanshi-${version}-x86_64.apk`)
} else {
  const candidates = [
    'app/build/outputs/apk/release/app-release.apk',
    'app/build/outputs/apk/debug/app-debug.apk',
  ]
  const apk = candidates
    .map((file) => path.join(android, file))
    .filter((file) => fs.existsSync(file))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0]
  if (!apk) {
    console.error('没有找到 APK')
    process.exit(1)
  }
  copy(apk, `guanshi-${version}.apk`)
}
