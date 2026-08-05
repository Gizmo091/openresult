import { libraryConfig } from '../../vite.config.base.js';

export default libraryConfig({
  entry: 'src/cli.ts',
  name: 'OpenResultCli',
  fileName: 'cli',
  external: [/^node:/, /^@openresult\//],
});
