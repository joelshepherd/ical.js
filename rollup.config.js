import { getBabelOutputPlugin } from '@rollup/plugin-babel';
import { terser } from 'rollup-plugin-terser';

export default {
  input: 'lib/ical/module.js',
  output: [
    { file: 'dist/ical.js',  format: 'es', exports: "named" },
    {
      file: 'dist/ical.min.js',
      format: 'es',
      exports: "named",
      plugins: [terser()]
    },
    {
      file: 'dist/ical.es5.js',
      exports: "named",
      format: 'cjs',
      plugins: [
        getBabelOutputPlugin({ presets: ['@babel/preset-env'] })
      ],
    },
    {
      file: 'dist/ical.es5.min.js',
      exports: "named",
      format: 'cjs',
      plugins: [
        getBabelOutputPlugin({ presets: ['@babel/preset-env'] }),
        terser()
      ]
    }
  ]
};
