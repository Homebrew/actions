import o from "ospec"

import {spawnPromisified} from './helper.js'
import { execPath, cwd } from 'node:process';
import {join} from 'node:path'

const fixture = id => join(cwd(), `./tests/fixtures/${id}/index.js`)

const localDir = import.meta.url.replace(/tests.js$/, '')

const prepare = stdout=> stdout.trim().split('\n').map(l => l.replace(localDir, ''))

o("works", async()=>{
	const {code, signal, stderr, stdout} = await spawnPromisified(execPath, [fixture('simple')])
	o(code).equals(0)
	o(stderr).equals('')
	o(prepare(stdout)).deepEquals([
		'fixtures/simple/transitive.js',
		'fixtures/simple/transitive.js?instance=esm-reload-0',
		'fixtures/simple/transitive.js?instance=1',
		'fixtures/simple/transitive.js?instance=esm-reload-1',
		'fixtures/simple/transitive.js?instance=2'
	])
})
