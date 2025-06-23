const path = require('path');

const isDev = process.env.NODE_ENV === 'development';

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  entry: './src/preload/preload.ts',
  target: 'electron-preload',
  devtool: isDev ? 'eval-cheap-module-source-map' : 'source-map',
  cache: {
    type: 'filesystem',
    cacheDirectory: path.resolve(__dirname, '.webpack-cache'),
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: {
          loader: 'swc-loader',
          options: {
            jsc: {
              parser: {
                syntax: 'typescript',
                tsx: false,
                decorators: false,
                dynamicImport: true,
              },
              target: 'es2020',
            },
            module: {
              type: 'commonjs',
            },
          },
        },
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@types': path.resolve(__dirname, 'src/types'),
    },
  },
  output: {
    filename: 'preload.js',
    path: path.resolve(__dirname, 'dist/preload'),
  },
};