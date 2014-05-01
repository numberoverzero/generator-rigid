'use strict';

module.exports = function (grunt) {

  // Load grunt tasks automatically
  require('load-grunt-tasks')(grunt);

  // Define the configuration for all the tasks
  grunt.initConfig({

    // Watches files for changes and runs tasks based on the changed files
    watch: {
      grunt: {
        files: [ 'Gruntfile.js' ],
        options: {
          reload: true
        }
      },
      bower: {
        files: ['bower.json'],
        tasks: ['bowerInstall']
      },
      js: {
        files: ['app/{,*/}*.js'],
        tasks: ['newer:jshint:all'],
        options: {
          livereload: true
        }
      },
      livereload: {
        options: {
          livereload: '<%%= connect.options.livereload %>',
          debounceDelay: 100
        },
        files: [
          'app/{,*/}*.html',
          //'.tmp/styles/{,*/}*.css',
          'app/{,*/}*.{js,css}',
          'app/img/{,*/}*.{png,jpg,jpeg,gif,webp,svg}'
        ]
      }
    },

    // The actual grunt server settings
    connect: {
      options: {
        port: 9000,
        // Change this to '0.0.0.0' to access the server from outside.
        hostname: 'localhost',
        livereload: 35729
      },
      livereload: {
        options: {
          open: true,
          base: [
            'app'
          ]
        }
      }
    },

    // Make sure code styles are up to par and there are no obvious mistakes
    jshint: {
      options: {
        jshintrc: '.jshintrc',
        reporter: require('jshint-stylish')
      },
      all: [
        'Gruntfile.js',
        'app/js/**/*.js'
      ]
    },

    // Automatically inject Bower components into the app
    bowerInstall: {
      app: {
        src: ['app/index.html'],
        ignorePath: 'app/'
      }
    },

  });

  grunt.registerTask('serve', [
    'bowerInstall',
    'connect:livereload',
    'watch'
  ]);
  grunt.registerTask('default', ['serve']);
};
