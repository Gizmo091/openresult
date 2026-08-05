import { libraryConfig } from '../../../../vite.config.base.js';

export default libraryConfig({
  entry: 'src/index.ts',
  name: 'OpenResultConformance',
  external: [/^node:/, /^@openresult\//],
});
