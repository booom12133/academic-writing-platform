const crypto = require('node:crypto');
const path = require('node:path');
const ts = require('typescript');

const configPath = path.resolve(__dirname, '../../tsconfig.node.json');
const parsedConfig = ts.getParsedCommandLineOfConfigFile(configPath, {}, {
  ...ts.sys,
  onUnRecoverableConfigFileDiagnostic(diagnostic) {
    throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
  },
});

if (!parsedConfig) {
  throw new Error(`Unable to load TypeScript configuration: ${configPath}`);
}

const compilerOptions = {
  ...parsedConfig.options,
  composite: false,
  declaration: false,
  incremental: false,
  inlineSourceMap: true,
  inlineSources: true,
  noEmit: false,
  sourceMap: false,
};
const compilerOptionsKey = JSON.stringify(compilerOptions);

module.exports = {
  getCacheKey(sourceText, sourcePath) {
    return crypto
      .createHash('sha256')
      .update(sourceText)
      .update(sourcePath)
      .update(compilerOptionsKey)
      .digest('hex');
  },

  process(sourceText, sourcePath) {
    const result = ts.transpileModule(sourceText, {
      compilerOptions,
      fileName: sourcePath,
    });

    return { code: result.outputText };
  },
};
