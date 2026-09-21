module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['.'],
          alias: {
            '@': './src',
            '@app': './src/app',
            '@modules': './src/modules',
            // Shared package. Metro resolves @azglobe/core through the
            // workspace symlink; this alias keeps the subpath imports
            // (@core/theme, @core/ui) working unchanged across the move.
            '@core': '../../packages/core/src',
          },
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },
      ],
      // react-native-worklets/plugin must stay last (Reanimated 4 requirement).
      'react-native-worklets/plugin',
    ],
  };
};
