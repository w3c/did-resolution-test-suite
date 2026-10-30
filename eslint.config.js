import config from '@digitalbazaar/eslint-config';
import globals from 'globals';
import jsdocConfig from '@digitalbazaar/eslint-config/jsdoc';
import moduleConfig from '@digitalbazaar/eslint-config/module';

export default [
  ...config,
  ...jsdocConfig,
  ...moduleConfig,
  {
    files: ['tests/**'],
    languageOptions: {
      globals: {
        ...globals.mocha,
        fetch: 'readonly',
        Response: 'readonly',
        URL: 'readonly'
      }
    }
  },
  {
    files: ['did-url-dereferencing/**'],
    languageOptions: {
      globals: {...globals.node, ...globals.mocha}
    }
  }
];
