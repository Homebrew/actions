"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const io = __importStar(require("@actions/io"));
const exec = __importStar(require("@actions/exec"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs_1 = require("fs");
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const keyName = core.getInput('key_name', { required: true });
            const key = core.getInput('key', { required: true });
            const user = core.getInput('git_user');
            const email = core.getInput('git_email');
            if (user && email) {
                yield exec.exec('git', ['config', '--global', 'user.name', user]);
                yield exec.exec('git', ['config', '--global', 'user.email', email]);
            }
            const sshDir = path.join(os.homedir(), '.ssh');
            yield io.mkdirP(sshDir);
            yield fs_1.promises.chmod(sshDir, '0700');
            const keyFile = path.join(sshDir, keyName);
            yield fs_1.promises.writeFile(keyFile, key + os.EOL);
            yield fs_1.promises.chmod(keyFile, '0600');
            yield exec.exec('git', [
                'config', '--global', 'core.sshCommand',
                `ssh -i '${keyFile}' -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no`,
            ]);
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
