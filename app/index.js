'use strict';
var fs = require('fs'),
    util = require('util'),
    path = require('path'),
    yeoman = require('yeoman-generator'),
    chalk = require('chalk'),
    github = require('octonode'),
    q = require('q'),
    command;

function gitCommand() {
  var args = Array.prototype.slice.call(arguments);
  var cmd = 'git ' + args.join(' ');
  var deferred = q.defer();
  this.log(chalk.bold(cmd));
  command('git', args)
  .on('error', onError)
  .on('exit', function (err) {
    if (err) { onError(err); }
    else {
     deferred.resolve();
    }
  });
  function onError(err) {
    throw new Error('git command failed: ' + err);
  }
  return deferred.promise;
}

var RigidGenerator = yeoman.generators.Base.extend({
  init: function () {
    this.pkg = require('../package.json');
    command = this.spawnCommand;

    this.on('end', function () {
      this.installDependencies({
        skipInstall: this.options['skip-install'],
        callback: function() {
          this.emit('dependenciesInstalled');
        }.bind(this)
      });
    });

    this.on('dependenciesInstalled', function() {
      //this.spawnCommand('grunt');
    })
  },

  askFor: function () {
    var done = this.async();

    // have Yeoman greet the user
    this.log(this.yeoman);

    // replace it with a short and sweet description of your generator
    this.log(chalk.magenta('Rigid - micro template for rapid prototyping.'));

    var prompts = [{
      name: 'projName',
      message: 'What is this prototype called?',
      default: process.cwd().split(path.sep).pop()
    },
    {
      type: 'confirm',
      name: 'createGithubRepo',
      message: 'Do you want to create a repository on github?',
      default: true
    },
    {
      when: function(props) {
        return props.createGithubRepo;
      },
      name: 'githubRepoName',
      message: 'What would you like to call the repository?',
      default: function(props) {
        return 'proto-' + props.projName;
      }
    },
    {
      when: function(props) {
        return props.createGithubRepo;
      },
      name: 'githubPersonalAccessTokenFile',
      message: 'Where is your personal access token stored?',
      default: function(props) {
        return path.join(process.env.HOME, '.githubtoken');
      }
    }];

    this.prompt(prompts, function (props) {
      this.projName = props.projName;
      this.githubRepo = {
        create: props.createGithubRepo,
        created: false,
        name: props.githubRepoName,
        fullName: props.githubRepoName,
        tokenFile: props.githubPersonalAccessTokenFile
      };

      done();
    }.bind(this));
  },

  app: function () {
    this.mkdir('app');
    'js css img'.split(' ').forEach(function(folder) {
      this.mkdir('app/' + folder);
    }, this);

    this.template('_LICENSE', 'LICENSE');
    this.template('_bower.json', 'bower.json');
    this.template('_index.html', 'app/index.html');
    this.template('_package.json', 'package.json');
    this.copy('Gruntfile.js', 'Gruntfile.js');
    this.copy('style.css', 'app/css/style.css');
  },

  projectfiles: function () {
    this.copy('bowerrc', '.bowerrc');
    this.copy('editorconfig', '.editorconfig');
    this.copy('gitattributes', '.gitattributes');
    this.copy('gitignore', '.gitignore');
    this.copy('jshintrc', '.jshintrc');
  },

  createGithubRepository: function() {
    if(!this.githubRepo.create) {
      return;
    }

    // Try to get a github Personal access token https://github.com/settings/applications
    var token = fs.readFileSync(this.githubRepo.tokenFile, 'utf8').trim();
    if(!token) {
      this.log(
        chalk.red.bold(
          'Failed to read token. Expected single line with token at ('
            + this.githubRepo.tokenFile
            + ').'
        )
      );
      return; // No token means we can't continue
    }

    // Create a repository!
    var self = this;
    var done = this.async();
    var client = github.client(token);
    var ghme = client.me();
    ghme.repo({
      'name': this.githubRepo.name
    }, function (err, data, headers) {
      if(err) {
        self.log(chalk.red.bold('Failed to create GitHub Repository: ' + err));
      } else {
        self.githubRepo.created = true;
        self.githubRepo.url = data.ssh_url;
        self.githubRepo.fullName = data.full_name;
        self.log(chalk.green('Successfully created GitHub Repository ' + data.full_name));
      }
      done();
    });
  },

  setupLocalRepo : function() {
    var self = this,
        git = gitCommand.bind(self);

    var isRepository = false;
    try {
      var stats = fs.lstatSync('.git');
      isRepository = stats && stats.isDirectory();
    } catch (e) { /* not a repository */}

    var commands = [
      ['init'],
      ['add', '-A'],
      ['commit', '-m', 'initial commit'],
      ['remote', 'add', 'origin', self.githubRepo.url],
      ['push', '-u', 'origin', 'master']
    ];

    if(isRepository) {
      commands.shift(); // Don't init
    }
    if(!self.githubRepo.created) {
      commands.pop(); // Don't add remote
      commands.pop(); // Don't push to origin/master
    }
    console.log(commands);

    var done = self.async(),
        d = q.defer(),
        n = d.promise;
    commands.forEach(function(args) {
      n = n.then(function() { return git.apply(self, args); });
    });
    n.then(function() { done();});
    d.resolve();
  }
});

module.exports = RigidGenerator;
