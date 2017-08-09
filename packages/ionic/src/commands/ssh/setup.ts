import * as chalk from 'chalk';

import { BACKEND_PRO, CommandLineInputs, CommandLineOptions } from '@ionic/cli-utils';
import { CommandMetadata } from '@ionic/cli-utils/lib/command';
import { pathExists } from '@ionic/cli-utils/lib/utils/fs';

import { SSHBaseCommand } from './base';

@CommandMetadata({
  name: 'setup',
  type: 'global',
  backends: [BACKEND_PRO],
  description: 'Setup your Ionic SSH keys automatically',
})
export class SSHSetupCommand extends SSHBaseCommand {
  async preRun() {
    await this.checkForOpenSSH();
  }

  async run(inputs: CommandLineInputs, options: CommandLineOptions): Promise<void | number> {
    const { prettyPath } = await import('@ionic/cli-utils/lib/utils/format');
    const { getGeneratedPrivateKeyPath } = await import('@ionic/cli-utils/lib/ssh');
    const { getConfigPath } = await import('@ionic/cli-utils/lib/ssh-config');

    const config = await this.env.config.load();

    const sshconfigPath = getConfigPath();
    const keyPath = await getGeneratedPrivateKeyPath(this.env);
    const pubkeyPath = `${keyPath}.pub`;

    // TODO: link to docs about manual git setup

    const [ pubkeyExists, keyExists ] = await Promise.all([pathExists(keyPath), pathExists(pubkeyPath)]);

    if (config.git.setup) {
      const rerun = await this.env.prompt({
        type: 'confirm',
        name: 'confirm',
        message: `SSH setup wizard has run before. Would you like to run it again?`,
      });

      if (!rerun) {
        return 0;
      }
    } else if (!pubkeyExists && !keyExists) {
      this.env.log.info(
        'The automatic SSH setup will do the following:\n' +
        `1) Generate a new SSH key pair with OpenSSH (will not overwrite any existing keys).\n` +
        `2) Upload the generated SSH public key to our server, registering it on your account.\n` +
        `3) Modify your SSH config (${chalk.bold(prettyPath(sshconfigPath))}) to use the generated SSH private key for our server(s).`
      );

      const confirm = await this.env.prompt({
        type: 'confirm',
        name: 'confirm',
        message: 'May we proceed?',
      });

      if (!confirm) {
        return 1;
      }
    }

    if (pubkeyExists && keyExists) {
      this.env.log.info(
        `Using your previously generated key: ${chalk.bold(prettyPath(keyPath))}.\n` +
        `You can generate a new one by deleting it.`
      );
    } else {
      await this.runcmd(['ssh', 'generate', keyPath]);
    }

    await this.runcmd(['ssh', 'add', pubkeyPath, '--use']);

    config.git.setup = true;

    this.env.log.ok('SSH setup successful!');
  }
}