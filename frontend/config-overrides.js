const webpack = require('webpack');

module.exports = function override(config) {
  config.resolve.fallback = {
    crypto: require.resolve('crypto-browserify'),
    stream: require.resolve('stream-browserify'),
    buffer: require.resolve('buffer'),
    process: require.resolve('process'),
    zlib: require.resolve('browserify-zlib'),
    http: require.resolve('stream-http'),
    https: require.resolve('https-browserify'),
    url: require.resolve('url'),
    assert: require.resolve('assert'),
    path: false,
    fs: false,
    os: false,
  };

  config.plugins.push(
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    })
  );

  // Suppress source map warnings from paillier-bigint
  config.ignoreWarnings = [/Failed to parse source map/];

  return config;
};