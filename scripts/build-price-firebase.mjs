import {build} from 'esbuild';
await build({entryPoints:['scripts/firebase/entry.js'],bundle:true,format:'esm',target:'es2022',minify:true,legalComments:'linked',outfile:'public/planning/vendor/firebase.mjs'});
