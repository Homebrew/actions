import * as core from '@actions/core'
import * as io from '@actions/io'
import * as exec from '@actions/exec'
import * as path from 'path'
import * as os from 'os'
import { promises as fs } from 'fs'

async function run() {
  try {
    const keyName = core.getInput('key_name', {required: true})
    const key = core.getInput('key', {required: true})

    const user = core.getInput('git_user')
    const email = core.getInput('git_email')

    if (user && email) {
      await exec.exec('git', ['config', '--global', 'user.name', user])
      await exec.exec('git', ['config', '--global', 'user.email', email])
    }

    const sshDir = path.join(os.homedir(), '.ssh')
    await io.mkdirP(sshDir)
    await fs.chmod(sshDir, '0700')

    const keyFile = path.join(sshDir, keyName)
    await fs.writeFile(keyFile, key)
    await fs.chmod(keyFile, '0600')

    await exec.exec('git', [
      'config', '--global', 'core.sshCommand',
      `ssh -i '${keyFile}' -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no`,
    ])
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
