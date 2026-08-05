import { libraryConfig } from '../../../../vite.config.base.js';

export default libraryConfig({
  entry: 'src/index.ts',
  name: 'OpenResultValidate',
  external: [/^ajv/, '@openresult/core'],
});
