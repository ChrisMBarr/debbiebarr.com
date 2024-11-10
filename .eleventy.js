const sass = require('sass');
const path = require('node:path');
const htmlMin = require('html-minifier');
const esbuild = require('esbuild');
const nunjucks = require('nunjucks');
const dateFilter = require('nunjucks-date-filter');

module.exports = (eleventyConfig) => {
  const isBuildMode = process.env.ELEVENTY_RUN_MODE === 'build';
  const baseUrl = isBuildMode ? 'https://debbiebarr.com/' : 'http://localhost:8080/';

  eleventyConfig.addGlobalData('isBuildMode', isBuildMode);

  eleventyConfig.addPassthroughCopy('src/img');

  eleventyConfig.addFilter('date', dateFilter);
  eleventyConfig.addFilter('absoluteUrl', (url) => new URL(url, baseUrl).href);
  eleventyConfig.addFilter('cacheBreakerQueryString', (url) => `${url}?publish=${Date.now()}`);
  eleventyConfig.addNunjucksFilter('interpolate', (str) => nunjucks.renderString(str, eleventyConfig));

  eleventyConfig.addTemplateFormats('js');
  eleventyConfig.addExtension('js', {
    outputFileExtension: 'js',
    compile: async (inputContent) => {
      const result = await esbuild.transform(inputContent, {
        minify: isBuildMode,
        target: 'es2020',
      });

      return () => result.code;
    },
  });

  eleventyConfig.addTemplateFormats('scss');
  eleventyConfig.addExtension('scss', {
    outputFileExtension: 'css',
    compile: async function (inputContent, inputPath) {
      const parsedPath = path.parse(inputPath);

      //Skip directly compiling SCSS files that have a leading underscore as these are only imported by other files
      if (parsedPath.name.startsWith('_')) return;

      //Compile the SCSS to CSS
      const result = sass.compileString(inputContent, {
        loadPaths: [parsedPath.dir || '.', eleventyConfig.dir.includes],
        style: isBuildMode ? 'compressed' : 'expanded',
      });

      //Mark any imported/dependent files to allow them to trigger a re-build during serve mode
      this.addDependencies(inputPath, result.loadedUrls);

      //Write the CSS file out
      return async () => await result.css;
    },
  });

  eleventyConfig.addTransform('htmlMin', (content, outputPath) => {
    if (isBuildMode && (outputPath.endsWith('.html') || outputPath.endsWith('.njk'))) {
      return htmlMin.minify(content, {
        collapseWhitespace: true,
        removeComments: true,
        useShortDoctype: true,
        minifyJS: true,
      });
    }

    return content;
  });

  return {
    dir: { input: 'src' },
  };
};
