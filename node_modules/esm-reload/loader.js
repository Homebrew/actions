export {resolve}

import {register, isBuiltin} from 'node:module';

if (!import.meta.url.endsWith("?loader")) {
    register(`${import.meta.url}?loader`);
}

const selfURL = import.meta.url.replace(/\?loader$/, '')
const isSelf = url => url === selfURL

let id = 0;

async function resolve(specifier, context, nextResolve) {
	const result = await nextResolve(specifier, context);

	if (!isSelf(result.url) && !isBuiltin(result.url) && context.parentURL) {
		const url = new URL(result.url);
		const parentUrl = new URL(context.parentURL);
		const instance = url.searchParams.get("reload") === ""
			? `esm-reload-${id++}`
			: parentUrl.searchParams.get("instance");

		if (instance !== null) {
			if (url.searchParams.has('reload')) {
				url.searchParams.delete('reload')
			}
			url.searchParams.set("instance", instance);

			return {
				...result,
				url: `${url}`,
			};
		}
	}
	return result;
}
