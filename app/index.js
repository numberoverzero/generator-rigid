'use strict';
var fs = require('fs');
var util = require('util');
var path = require('path');
var yeoman = require('yeoman-generator');
var chalk = require('chalk');
var github = require('octonode');
var q = require('q');

function gitCommand() {
  var deferred = q.defer();
  var args = Array.prototype.slice.call(arguments);
  this.log(chalk.bold('git ' + args.join(' ')));

  this.spawnCommand('git', args)
   .on('error', onError)
   .on('exit', function (err) {
     if (err) { onError(err); }
     else { deferred.resolve(); }
   });

   function onError(err) {
     throw new Error('Failed to run git command: ' + err);
   }

  return deferred.promise;
}

var RigidGenerator = yeoman.generators.Base.extend({
  init: function () {
    this.pkg = require('../package.json');
    this.gitCommand = gitCommand.bind(this);

    this.on('end', function () {
      if (!this.options['skip-install']) {
        this.installDependencies();
      }
    });
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
      default: 'demo'
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

  createGithubRepository: function() {
    if(!this.githubRepo.create) {
      return;
    }

    // Try to get a github Personal access token https://github.com/settings/applications
    var token = fs.readFileSync(this.githubRepo.tokenFile, 'utf8').trim();
    if(!token) {
      this.log(
        chalk.yellow.bold(
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
        self.log(chalk.yellow.bold('Failed to create GitHub Repository: ' + err));
      } else {
        self.githubRepo.created = true;
        self.githubRepo.url = data.ssh_url;
        self.githubRepo.fullName = data.full_name;
        self.log(chalk.green('Successfully created GitHub Repository ' + data.full_name));
      }
      done();
    });
  },

  setTitle: function() {
    this.title = this.githubRepo.created ? this.githubRepo.fullName : this.projName;
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

  commitGithubRepository: function() {
    if(!this.githubRepo.created) {
      return;
    }

    var doneCommit = this.async();

    function isRepository() {
      try {
        var stats = fs.lstatSync('.git');
        return stats && stats.isDirectory();
      } catch (e) { return false; }
    }
    function complete() { doneCommit(); }

    var d = q.defer();
    var commands = [d];
    if(!isRepository()) {
      commands.push(this.gitCommand('init'));
    }
    commands.push(this.gitCommand('add', '-A'));
    commands.push(this.gitCommand('commit', '-m', 'Initial commit'));
    commands.push(this.gitCommand('remote', 'add', 'origin', this.githubRepo.url));
    commands.push(this.gitCommand('push', '-u', 'origin', 'master'));
    commands.reduce(q.when, q(d)).then(complete);
    d.resolve();
  }
});

module.exports = RigidGenerator;
