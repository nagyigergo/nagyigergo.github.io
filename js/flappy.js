(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var global=typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {};window.BlocklyApps = require('./base');

if (typeof global !== 'undefined') {
  global.BlocklyApps = window.BlocklyApps;
}

var addReadyListener = require('./dom').addReadyListener;

function StubDialog() {
  for (var argument in arguments) {
    console.log(argument);
  }
}
StubDialog.prototype.show = function() {
  console.log("Showing Dialog");
  console.log(this);
};
StubDialog.prototype.hide = function() {
  console.log("Hiding Dialog");
  console.log(this);
};

module.exports = function(app, levels, options) {

  // If a levelId is not provided, then options.level is specified in full.
  // Otherwise, options.level overrides resolved level on a per-property basis.
  if (options.levelId) {
    var level = levels[options.levelId];
    options.level = options.level || {};
    options.level.id = options.levelId;
    for (var prop in options.level) {
      level[prop] = options.level[prop];
    }

    options.level = level;
  }

  options.Dialog = options.Dialog || StubDialog;

  BlocklyApps.BASE_URL = options.baseUrl;
  BlocklyApps.CACHE_BUST = options.cacheBust;
  BlocklyApps.LOCALE = options.locale || BlocklyApps.LOCALE;

  BlocklyApps.assetUrl = function(path) {
    var url = options.baseUrl + path;
    if (BlocklyApps.CACHE_BUST) {
      return url + '?v=' + options.cacheBust;
    } else {
      return url;
    }
  };

  options.skin = options.skinsModule.load(BlocklyApps.assetUrl, options.skinId);
  options.blocksModule.install(Blockly, options.skin);

  addReadyListener(function() {
    if (options.readonly) {
      BlocklyApps.initReadonly(options);
    } else {
      app.init(options);
      if (options.onInitialize) {
        options.onInitialize();
      }
    }
  });

};

},{"./base":2,"./dom":5}],2:[function(require,module,exports){
/**
 * Blockly Apps: Common code
 *
 * Copyright 2013 Google Inc.
 * http://blockly.googlecode.com/
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Common support code for Blockly apps.
 * @author fraser@google.com (Neil Fraser)
 */
"use strict";
var BlocklyApps = module.exports;
var msg = require('../locale/en_us/common');
var parseXmlElement = require('./xml').parseElement;
var feedback = require('./feedback.js');
var dom = require('./dom');
var utils = require('./utils');
var builder = require('./builder');
var Slider = require('./slider');

//TODO: These should be members of a BlocklyApp instance.
var onAttempt;
var onContinue;
var backToPreviousLevel;

/**
 * The parent directory of the apps. Contains common.js.
 */
BlocklyApps.BASE_URL = undefined;

/**
 * If truthy, a version number to be appended to asset urls.
 */
BlocklyApps.CACHE_BUST = undefined;

/**
 * The current locale code.
 */
BlocklyApps.LOCALE = 'en_us';

/**
 * The minimum width of a playable whole blockly game.
 */
BlocklyApps.MIN_WIDTH = 900;
BlocklyApps.MIN_MOBILE_SHARE_WIDTH = 450;

/**
 * If the user presses backspace, stop propagation - this prevents blockly
 * from eating the backspace key
 * @param {!Event} e Keyboard event.
 */
var codeKeyDown = function(e) {
  if (e.keyCode == 8) {
    e.stopPropagation();
  }
};

/**
 * Common startup tasks for all apps.
 */
BlocklyApps.init = function(config) {
  if (!config) {
    config = {};
  }

  BlocklyApps.share = config.share;

  // Store configuration.
  onAttempt = config.onAttempt || function(report) {
    console.log('Attempt!');
    console.log(report);
    if (report.onComplete) {
      report.onComplete();
    }
  };
  onContinue = config.onContinue || function() {
    console.log('Continue!');
  };
  backToPreviousLevel = config.backToPreviousLevel || function() {};

  var container = document.getElementById(config.containerId);
  container.innerHTML = config.html;
  var runButton = container.querySelector('#runButton');
  var resetButton = container.querySelector('#resetButton');
  dom.addClickTouchEvent(runButton, BlocklyApps.runButtonClick);
  dom.addClickTouchEvent(resetButton, BlocklyApps.resetButtonClick);

  var belowViz = document.getElementById('belowVisualization');
  if (config.referenceArea) {
    belowViz.appendChild(config.referenceArea());
  }

  if (config.hide_source) {
    var blockly = container.querySelector('#blockly');
    container.className = 'hide-source';
    blockly.style.display = 'none';
    // For share page on mobile, do not show this part.
    if (!BlocklyApps.share || !dom.isMobile()) {
      var buttonRow = runButton.parentElement;
      var openWorkspace = document.createElement('button');
      openWorkspace.setAttribute('id', 'open-workspace');
      openWorkspace.appendChild(document.createTextNode(msg.openWorkspace()));

      belowViz.appendChild(feedback.createSharingButtons({
        response: {
          level_source: window.location
        },
        twitter: config.twitter
      }));

      dom.addClickTouchEvent(openWorkspace, function() {
        // Redirect user to /edit version of this page. It would be better
        // to just turn on the workspace but there are rendering issues
        // with that.
        window.location.href = window.location.href + '/edit';
      });

      buttonRow.appendChild(openWorkspace);
    }
  }

  // 1. Move the buttons, 2. Hide the slider in the share page for mobile.
  if (BlocklyApps.share && dom.isMobile()) {
    var sliderCell = document.getElementById('slider-cell');
    if (sliderCell) {
      sliderCell.style.display = 'none';
    }
    var belowVisualization = document.getElementById('belowVisualization');
    if (belowVisualization) {
      belowVisualization.style.display = 'block';
      belowVisualization.style.marginLeft = '0px';
    }
  }

  // Show flappy upsale on desktop and mobile.  Show learn upsale only on desktop
  if (BlocklyApps.share) {
    var upSale = document.createElement('div');
    if (config.makeYourOwn) {
      upSale.innerHTML = require('./templates/makeYourOwn.html')();
    } else if (!dom.isMobile()) {
      upSale.innerHTML = require('./templates/learn.html')();
    }
    belowViz.appendChild(upSale);
  }

  // Record time at initialization.
  BlocklyApps.initTime = new Date().getTime();

  // Fixes viewport for small screens.
  var viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    var widthDimension;
    var minWidth;
    if (BlocklyApps.share && dom.isMobile()) {
      // for mobile sharing, don't assume landscape mode, use screen.width
      widthDimension = screen.width;
      minWidth = BlocklyApps.MIN_MOBILE_SHARE_WIDTH;
    }
    else {
      // assume we are in landscape mode, so width is the longer of the two
      widthDimension = Math.max(screen.width, screen.height);
      minWidth = BlocklyApps.MIN_WIDTH;
    }
    var width = Math.max(minWidth, widthDimension);
    var scale = widthDimension / width;
    var content = ['width=' + width,
                   'initial-scale=' + scale,
                   'maximum-scale=' + scale,
                   'minimum-scale=' + scale,
                   'target-densityDpi=device-dpi',
                   'user-scalable=no'];
    viewport.setAttribute('content', content.join(', '));
  }

  if (config.level.editCode) {
    BlocklyApps.editCode = true;
    var codeTextbox = document.getElementById('codeTextbox');
    var codeFunctions = config.level.codeFunctions;
    // Insert hint text from level codeFunctions into editCode area
    if (codeFunctions) {
      var hintText = "";
      for (var i = 0; i < codeFunctions.length; i++) {
        hintText = hintText + " " + codeFunctions[i].func + "();";
      }
      var html = utils.escapeHtml(msg.typeFuncs()).replace('%1', hintText);
      codeTextbox.innerHTML += '// ' + html + '<br><br><br>';
    }
    // Needed to prevent blockly from swallowing up the backspace key
    codeTextbox.addEventListener('keydown', codeKeyDown, true);
  }

  BlocklyApps.Dialog = config.Dialog;

  var showCode = document.getElementById('show-code-header');
  if (showCode) {
    dom.addClickTouchEvent(showCode, function() {
      feedback.showGeneratedCode(BlocklyApps.Dialog);
    });
  }

  BlocklyApps.ICON = config.skin.staticAvatar;
  BlocklyApps.SMALL_ICON = config.skin.smallStaticAvatar;
  BlocklyApps.WIN_ICON = config.skin.winAvatar;
  BlocklyApps.FAILURE_ICON = config.skin.failureAvatar;

  if (config.showInstructionsWrapper) {
    config.showInstructionsWrapper(function() {
      showInstructions(config.level);
    });
  }

  // The share page does not show the rotateContainer.
  if (BlocklyApps.share) {
    var rotateContainer = document.getElementById('rotateContainer');
    if (rotateContainer) {
      rotateContainer.style.display = 'none';
    }
  }
  var orientationHandler = function() {
    window.scrollTo(0, 0);  // Browsers like to mess with scroll on rotate.
    var rotateContainer = document.getElementById('rotateContainer');
    rotateContainer.style.width = window.innerWidth + 'px';
    rotateContainer.style.height = window.innerHeight + 'px';
  };
  window.addEventListener('orientationchange', orientationHandler);
  orientationHandler();

  if (config.loadAudio) {
    config.loadAudio();
  }

  if (config.level.instructions) {
    var promptDiv = document.getElementById('prompt');
    dom.setText(promptDiv, config.level.instructions);

    var promptIcon = document.getElementById('prompt-icon');
    promptIcon.src = BlocklyApps.SMALL_ICON;
  }

  var div = document.getElementById('blockly');
  var options = {
    toolbox: config.level.toolbox
  };
  if (config.trashcan !== undefined) {
    options.trashcan = config.trashcan;
  }
  BlocklyApps.inject(div, options);

  if (config.afterInject) {
    config.afterInject();
  }

  // Initialize the slider.
  var slider = document.getElementById('slider');
  if (slider) {
    Turtle.speedSlider = new Slider(10, 35, 130, slider);

    // Change default speed (eg Speed up levels that have lots of steps).
    if (config.level.sliderSpeed) {
      Turtle.speedSlider.setValue(config.level.sliderSpeed);
    }
  }

  if (config.level.editCode) {
    document.getElementById('codeTextbox').style.display = 'block';
    div.style.display = 'none';
  }

  // Add the starting block(s).
  var startBlocks = config.level.startBlocks || '';
  startBlocks = BlocklyApps.arrangeBlockPosition(startBlocks);
  BlocklyApps.loadBlocks(startBlocks);

  var onResize = function() {
    BlocklyApps.onResize(config.getDisplayWidth());
  };

  // listen for scroll and resize to ensure onResize() is called
  window.addEventListener('scroll', function() {
    onResize();
    Blockly.fireUiEvent(window, 'resize');
  });
  window.addEventListener('resize', onResize);

  // call initial onResize() asynchronously - need 100ms delay to work
  // around relayout which changes height on the left side to the proper
  // value
  window.setTimeout(function() {
      onResize();
      Blockly.fireUiEvent(window, 'resize');
    },
    100);

  BlocklyApps.reset(true);

  // Add display of blocks used.
  setIdealBlockNumber();
  Blockly.addChangeListener(function() {
    BlocklyApps.updateBlockCount();
  });
};

exports.playAudio = function(name, options) {
  Blockly.playAudio(name, options);
};

exports.stopLoopingAudio = function(name) {
  Blockly.stopLoopingAudio(name);
};

/**
 * @param {Object} options Configuration parameters for Blockly. Parameters are
 * optional and include:
 *  - {string} path The root path to the /blockly directory, defaults to the
 *    the directory in which this script is located.
 *  - {boolean} rtl True if the current language right to left.
 *  - {DomElement} toolbox The element in which to insert the toolbox,
 *    defaults to the element with 'toolbox'.
 *  - {boolean} trashcan True if the trashcan should be displayed, defaults to
 *    true.
 * @param {DomElement} div The parent div in which to insert Blockly.
 */
exports.inject = function(div, options) {
  var defaults = {
    assetUrl: BlocklyApps.assetUrl,
    rtl: BlocklyApps.isRtl(),
    toolbox: document.getElementById('toolbox'),
    trashcan: true
  };
  Blockly.inject(div, utils.extend(defaults, options));
};

/**
 * Returns true if the current HTML page is in right-to-left language mode.
 */
BlocklyApps.isRtl = function() {
  var head = document.getElementsByTagName('head')[0];
  if (head && head.parentElement) {
    var dir = head.parentElement.getAttribute('dir');
    return (dir && dir.toLowerCase() == 'rtl');
  } else {
    return false;
  }
};

BlocklyApps.localeDirection = function() {
  return (BlocklyApps.isRtl() ? 'rtl' : 'ltr');
};

/**
 * Initialize Blockly for a readonly iframe.  Called on page load.
 * XML argument may be generated from the console with:
 * Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(Blockly.mainWorkspace)).slice(5, -6)
 */
BlocklyApps.initReadonly = function(options) {
  Blockly.inject(document.getElementById('blockly'), {
    assetUrl: BlocklyApps.assetUrl,
    readOnly: true,
    rtl: BlocklyApps.isRtl(),
    scrollbars: false
  });
  BlocklyApps.loadBlocks(options.blocks);
};

/**
 * Load the editor with blocks.
 * @param {string} blocksXml Text representation of blocks.
 */
BlocklyApps.loadBlocks = function(blocksXml) {
  var xml = parseXmlElement(blocksXml);
  Blockly.Xml.domToWorkspace(Blockly.mainWorkspace, xml);
};

BlocklyApps.BLOCK_X_COORDINATE = 70;
BlocklyApps.BLOCK_Y_COORDINATE = 30;
BlocklyApps.BLOCK_Y_COORDINATE_INTERVAL = 200;

/**
 * Spreading out the top blocks in workspace if it is not already set.
 */
BlocklyApps.arrangeBlockPosition = function(startBlocks) {
  var xml = parseXmlElement(startBlocks);
  for (var x = 0, xmlChild; xml.children && x < xml.children.length; x++) {
    xmlChild = xml.children[x];
    xmlChild.setAttribute('x', xmlChild.getAttribute('x') ||
                          BlocklyApps.BLOCK_X_COORDINATE);
    xmlChild.setAttribute('y',
                          xmlChild.getAttribute('y') ||
                          BlocklyApps.BLOCK_Y_COORDINATE +
                          BlocklyApps.BLOCK_Y_COORDINATE_INTERVAL * x);
  }
  return Blockly.Xml.domToText(xml);
};

var showInstructions = function(level) {
  level.instructions = level.instructions || '';

  var instructionsDiv = document.createElement('div');
  instructionsDiv.innerHTML = require('./templates/instructions.html')(level);

  var buttons = document.createElement('div');
  buttons.innerHTML = require('./templates/buttons.html')({
    data: {
      ok: true
    }
  });

  instructionsDiv.appendChild(buttons);

  var dialog = feedback.createModalDialogWithIcon({
      Dialog: BlocklyApps.Dialog,
      contentDiv: instructionsDiv,
      icon: BlocklyApps.ICON,
      defaultBtnSelector: '#ok-button'
      });
  var okayButton = buttons.querySelector('#ok-button');
  if (okayButton) {
    dom.addClickTouchEvent(okayButton, function() {
      dialog.hide();
    });
  }

  dialog.show();
};

/**
 *  Resizes the blockly workspace.
 */
BlocklyApps.onResize = function(gameWidth) {
  gameWidth = gameWidth || 0;
  var blocklyDiv = document.getElementById('blockly');
  var codeTextbox = document.getElementById('codeTextbox');

  // resize either blockly or codetextbox
  var div = BlocklyApps.editCode ? codeTextbox : blocklyDiv;

  var blocklyDivParent = blocklyDiv.parentNode;
  var parentStyle = window.getComputedStyle ?
                    window.getComputedStyle(blocklyDivParent) :
                    blocklyDivParent.currentStyle;  // IE

  var parentWidth = parseInt(parentStyle.width, 10);
  var parentHeight = parseInt(parentStyle.height, 10);

  var headers = document.getElementById('headers');
  var headersStyle = window.getComputedStyle ?
                       window.getComputedStyle(headers) :
                       headers.currentStyle;  // IE
  var headersHeight = parseInt(headersStyle.height, 10);

  div.style.top = blocklyDivParent.offsetTop + 'px';
  div.style.width = (parentWidth - (gameWidth + 15)) + 'px';
  if (BlocklyApps.isRtl()) {
    div.style.marginRight = (gameWidth + 15) + 'px';
  }
  else {
    div.style.marginLeft = (gameWidth + 15) + 'px';
  }
  // reduce height by headers height because blockly isn't aware of headers
  // and will size its svg element to be too tall
  div.style.height = (parentHeight - headersHeight) + 'px';

  BlocklyApps.resizeHeaders();
};

BlocklyApps.resizeHeaders = function() {
  var categoriesWidth = 0;
  var categories = Blockly.Toolbox.HtmlDiv;
  if (categories) {
    categoriesWidth = parseInt(window.getComputedStyle(categories).width, 10);
  }

  var workspaceWidth = Blockly.getWorkspaceWidth();
  var toolboxWidth = Blockly.getToolboxWidth();

  var workspaceHeader = document.getElementById('workspace-header');
  var toolboxHeader = document.getElementById('toolbox-header');
  var showCodeHeader = document.getElementById('show-code-header');

  var showCodeWidth = parseInt(window.getComputedStyle(showCodeHeader).width,
                               10);

  toolboxHeader.style.width = (categoriesWidth + toolboxWidth) + 'px';
  workspaceHeader.style.width = (workspaceWidth -
                                 toolboxWidth -
                                 showCodeWidth) + 'px';
};

/**
 * Highlight the block (or clear highlighting).
 * @param {?string} id ID of block that triggered this action.
 */
BlocklyApps.highlight = function(id) {
  if (id) {
    var m = id.match(/^block_id_(\d+)$/);
    if (m) {
      id = m[1];
    }
  }
  Blockly.mainWorkspace.highlightBlock(id);
};

/**
 * If the user has executed too many actions, we're probably in an infinite
 * loop.  Sadly I wasn't able to solve the Halting Problem.
 * @param {?string} opt_id ID of loop block to highlight.
 * @throws {Infinity} Throws an error to terminate the user's program.
 */
BlocklyApps.checkTimeout = function(opt_id) {
  if (opt_id) {
    BlocklyApps.log.push([null, opt_id]);
  }
  if (BlocklyApps.ticks-- < 0) {
    throw Infinity;
  }
};

// The following properties get their non-default values set by the application.

/**
 * Whether to alert user to empty blocks, short-circuiting all other tests.
 */
BlocklyApps.CHECK_FOR_EMPTY_BLOCKS = undefined;

/**
 * The ideal number of blocks to solve this level.  Users only get 2
 * stars if they use more than this number.
 * @type {!number=}
 */
BlocklyApps.IDEAL_BLOCK_NUM = undefined;

/**
 * An array of dictionaries representing required blocks.  Keys are:
 * - test (required): A test whether the block is present, either:
 *   - A string, in which case the string is searched for in the generated code.
 *   - A single-argument function is called on each user-added block
 *     individually.  If any call returns true, the block is deemed present.
 *     "User-added" blocks are ones that are neither disabled or undeletable.
 * - type (required): The type of block to be produced for display to the user
 *   if the test failed.
 * - titles (optional): A dictionary, where, for each KEY-VALUE pair, this is
 *   added to the block definition: <title name="KEY">VALUE</title>.
 * - value (optional): A dictionary, where, for each KEY-VALUE pair, this is
 *   added to the block definition: <value name="KEY">VALUE</value>
 * - extra (optional): A string that should be blacked between the "block"
 *   start and end tags.
 * @type {!Array=}
 */
BlocklyApps.REQUIRED_BLOCKS = undefined;

/**
 * The number of required blocks to give hints about at any one time.
 * Set this to Infinity to show all.
 * @type {!number=}
 */
BlocklyApps.NUM_REQUIRED_BLOCKS_TO_FLAG = undefined;

/**
 * Flag indicating whether the last program run completed the level.
 * @type {?boolean}
 */
BlocklyApps.levelComplete = null;

/**
 * Transcript of user's actions.  The format is application-dependent.
 * @type {?Array.<Array>}
 */
BlocklyApps.log = null;

/**
 * The number of steps remaining before the currently running program
 * is deemed to be in an infinite loop and terminated.
 * @type {?number}
 */
BlocklyApps.ticks = null;

/**
 * The number of attempts (how many times the run button has been pressed)
 * @type {?number}
 */
BlocklyApps.attempts = 0;

/**
 * Stores the time at init. The delta to current time is used for logging
 * and reporting to capture how long it took to arrive at an attempt.
 * @type {?number}
 */
BlocklyApps.initTime = undefined;

/**
 * Reset the playing field to the start position and kill any pending
 * animation tasks.  This will benerally be replaced by an application.
 * @param {boolean} first True if an opening animation is to be played.
 */
BlocklyApps.reset = function(first) {};

// Override to change run behavior.
BlocklyApps.runButtonClick = function() {};

/**
 * Enumeration of test results.
 * BlocklyApps.getTestResults() runs checks in the below order.
 * EMPTY_BLOCKS_FAIL can only occur if BlocklyApps.CHECK_FOR_EMPTY_BLOCKS true.
 */
BlocklyApps.TestResults = {
  NO_TESTS_RUN: -1,           // Default.
  EMPTY_BLOCK_FAIL: 1,        // 0 stars.
  TOO_FEW_BLOCKS_FAIL: 2,     // 0 stars.
  LEVEL_INCOMPLETE_FAIL: 3,   // 0 stars.
  MISSING_BLOCK_UNFINISHED: 4,// 0 star.
  MISSING_BLOCK_FINISHED: 10, // 1 star.
  OTHER_1_STAR_FAIL: 11,      // Application-specific 1-star failure.
  TOO_MANY_BLOCKS_FAIL: 20,   // 2 stars, try again or continue.
  OTHER_2_STAR_FAIL: 21,      // Application-specific 2-star failure.
  FLAPPY_SPECIFIC_FAIL: 22,   // Flappy failure
  FREE_PLAY: 30,              // 2 stars.
  ALL_PASS: 100               // 3 stars.
};

// Methods for determining and displaying feedback.

/**
 * Display feedback based on test results.  The test results must be
 * explicitly provided.
 * @param {{feedbackType: number}} Test results (a constant property of
 *     BlocklyApps.TestResults).
 */
BlocklyApps.displayFeedback = function(options) {
  options.Dialog = BlocklyApps.Dialog;
  options.onContinue = onContinue;
  options.backToPreviousLevel = backToPreviousLevel;

  feedback.displayFeedback(options);
};

BlocklyApps.getTestResults = function() {
  return feedback.getTestResults();
};

/**
 * Report back to the server, if available.
 * @param {object} options - parameter block which includes:
 * {string} app The name of the application.
 * {number} id A unique identifier generated when the page was loaded.
 * {string} level The ID of the current level.
 * {number} result An indicator of the success of the code.
 * {number} testResult More specific data on success or failure of code.
 * {string} program The user program, which will get URL-encoded.
 * {function} onComplete Function to be called upon completion.
 */
BlocklyApps.report = function(options) {
  // copy from options: app, level, result, testResult, program, onComplete
  var report = options;
  report.pass = feedback.canContinueToNextLevel(options.testResults);
  report.time = ((new Date().getTime()) - BlocklyApps.initTime);
  report.attempt = BlocklyApps.attempts;
  report.lines = feedback.getNumBlocksUsed();

  // Disable the run button until onReportComplete is called.
  if (!BlocklyApps.share) {
    document.getElementById('runButton').setAttribute('disabled', 'disabled');

    var onAttemptCallback = (function() {
      return function(builderDetails) {
        for (var option in builderDetails) {
          report[option] = builderDetails[option];
        }
        onAttempt(report);
      };
    })();

    // If this is the level builder, go to builderForm to get more info from
    // the level builder.
    if (options.builder) {
      builder.builderForm(onAttemptCallback);
    } else {
      onAttemptCallback();
    }
  }
};

/**
 * Click the reset button.  Reset the application.
 */
BlocklyApps.resetButtonClick = function() {
  document.getElementById('runButton').style.display = 'inline';
  document.getElementById('resetButton').style.display = 'none';
  Blockly.mainWorkspace.traceOn(false);
  BlocklyApps.reset(false);
};

/**
 * Set the ideal Number of blocks.
 */
var setIdealBlockNumber = function() {
  var element = document.getElementById('idealBlockNumber');
  if (element) {
    element.innerHTML = '';  // Remove existing children or text.
    element.appendChild(document.createTextNode(
        getIdealBlockNumberMsg()));
  }
};

/**
 * Add count of blocks used.
 */
exports.updateBlockCount = function() {
  // If the number of block used is bigger than the ideal number of blocks,
  // set it to be yellow, otherwise, keep it as black.
  var element = document.getElementById('blockUsed');
  if (BlocklyApps.IDEAL_BLOCK_NUM < feedback.getNumBlocksUsed()) {
    element.className = "block-counter-overflow";
  } else {
    element.className = "block-counter-default";
  }

  // Update number of blocks used.
  if (element) {
    element.innerHTML = '';  // Remove existing children or text.
    element.appendChild(document.createTextNode(
        feedback.getNumBlocksUsed() + feedback.getNumGivenBlocks()));
  }
};

var getIdealBlockNumberMsg = function() {
  return BlocklyApps.IDEAL_BLOCK_NUM === Infinity ?
      msg.infinity() :
      BlocklyApps.IDEAL_BLOCK_NUM + feedback.getNumGivenBlocks();
};

},{"../locale/en_us/common":30,"./builder":3,"./dom":5,"./feedback.js":6,"./slider":17,"./templates/buttons.html":19,"./templates/instructions.html":21,"./templates/learn.html":22,"./templates/makeYourOwn.html":23,"./utils":28,"./xml":29}],3:[function(require,module,exports){
var feedback = require('./feedback.js');
var dom = require('./dom.js');
// Builds the dom to get more info from the user. After user enters info
// and click "create level" onAttemptCallback is called to deliver the info
// to the server.
exports.builderForm = function(onAttemptCallback) {
  var builderDetails = document.createElement('div');
  builderDetails.innerHTML = require('./templates/builder.html')();
  var dialog = feedback.createModalDialogWithIcon({
    Dialog: BlocklyApps.Dialog,
    contentDiv: builderDetails,
    icon: BlocklyApps.ICON
  });
  var createLevelButton = document.getElementById('create-level-button');
  dom.addClickTouchEvent(createLevelButton, function() {
    var instructions = builderDetails.querySelector('[name="instructions"]').value;
    var name = builderDetails.querySelector('[name="level_name"]').value;
    onAttemptCallback({
      "instructions": instructions,
      "name": name
    });
  });

  dialog.show();
};

},{"./dom.js":5,"./feedback.js":6,"./templates/builder.html":18}],4:[function(require,module,exports){
var INFINITE_LOOP_TRAP = '  BlocklyApps.checkTimeout();\n';
var INFINITE_LOOP_TRAP_RE =
    new RegExp(INFINITE_LOOP_TRAP.replace(/\(.*\)/, '\\(.*\\)'), 'g');

/**
 * Returns javascript code to call a timeout check with an optional block id.
 */
exports.loopTrap = function(blockId) {
  var args = (blockId ? "'block_id_" + blockId + "'" : '');
 return INFINITE_LOOP_TRAP.replace('()', '(' + args + ')');
};

/**
 * Extract the user's code as raw JavaScript.
 * @param {string} code Generated code.
 * @return {string} The code without serial numbers and timeout checks.
 */
exports.strip = function(code) {
  return (code
    // Strip out serial numbers.
    .replace(/(,\s*)?'block_id_\d+'\)/g, ')')
    // Remove timeouts.
    .replace(INFINITE_LOOP_TRAP_RE, '')
    // Strip out class namespaces.
    .replace(/(BlocklyApps|Maze|Turtle)\./g, '')
    // Strip out particular helper functions.
    .replace(/^function (colour_random)[\s\S]*?^}/gm, '')
    // Collapse consecutive blank lines.
    .replace(/\n\n+/gm, '\n\n')
    // Trim.
    .replace(/^\s+|\s+$/g, '')
  );
};

/**
 * Extract the user's code as raw JavaScript.
 */
exports.workspaceCode = function(blockly) {
  var code = blockly.Generator.workspaceToCode('JavaScript');
  return exports.strip(code);
};

/**
 * Evaluates a string of code parameterized with a dictionary.
 */
exports.evalWith = function(code, options) {
  var params = [];
  var args = [];
  for (var k in options) {
    params.push(k);
    args.push(options[k]);
  }
  params.push(code);
  var ctor = function() {
    return Function.apply(this, params);
  };
  ctor.prototype = Function.prototype;
  var fn = new ctor();
  return fn.apply(null, args);
};

/**
 * Returns a function based on a string of code parameterized with a dictionary.
 */
exports.functionFromCode = function(code, options) {
  var params = [];
  var args = [];
  for (var k in options) {
    params.push(k);
    args.push(options[k]);
  }
  params.push(code);
  var ctor = function() {
    return Function.apply(this, params);
  };
  ctor.prototype = Function.prototype;
  return new ctor();
};

},{}],5:[function(require,module,exports){
exports.addReadyListener = function(callback) {
  if (document.readyState === "complete") {
    setTimeout(callback, 1);
  } else {
    window.addEventListener('load', callback, false);
  }
};

exports.getText = function(node) {
  return node.innerText || node.textContent;
};

exports.setText = function(node, string) {
  if (node.innerText) {
    node.innerText = string;
  } else {
    node.textContent = string;
  }
};


var addEvent = function(element, eventName, handler) {
  element.addEventListener(eventName, handler, false);

  var isIE11Touch = window.navigator.pointerEnabled;
  var isIE10Touch = window.navigator.msPointerEnabled;
  var isStandardTouch = 'ontouchend' in document.documentElement;

  var key;
  if (isIE11Touch) {
    key = "ie11";
  } else if (isIE10Touch) {
    key = "ie10";
  } else if (isStandardTouch) {
    key = "standard";
  }
  if (key) {
    var touchEvent = TOUCH_MAP[eventName][key];
    element.addEventListener(touchEvent, function(e) {
      e.preventDefault();  // Stop mouse events.
      handler(e);
    }, false);
  }
};

exports.addMouseDownTouchEvent = function(element, handler) {
  addEvent(element, 'mousedown', handler);
};

exports.addClickTouchEvent = function(element, handler) {
  addEvent(element, 'click', handler);
};

// A map from standard touch events to various aliases.
var TOUCH_MAP = {
  //  Incomplete list, add as needed.
  click: {
    standard: 'touchend',
    ie10: 'mspointerup',
    ie11: 'pointerup'
  },
  mousedown: {
    standard: 'touchstart',
    ie10: 'mspointerdown',
    ie11: 'pointerdown'
  }
};

exports.isMobile = function() {
  var reg = /Mobile|iP(hone|od|ad)|Android|BlackBerry|IEMobile/;
  return reg.test(window.navigator.userAgent);
};

},{}],6:[function(require,module,exports){
var trophy = require('./templates/trophy.html');
var utils = require('./utils');
var readonly = require('./templates/readonly.html');
var codegen = require('./codegen');
var msg = require('../locale/en_us/common');
var dom = require('./dom');

exports.displayFeedback = function(options) {
  options.level = options.level || {};
  options.numTrophies = numTrophiesEarned(options);

  var feedback = document.createElement('div');
  var feedbackMessage = getFeedbackMessage(options);
  var sharingDiv = createSharingDiv(options);
  var showCode = getShowCodeElement(options);
  var feedbackBlocks = new FeedbackBlocks(options);

  if (feedbackMessage) {
    feedback.appendChild(feedbackMessage);
  }
  if (options.numTrophies) {
    var trophies = getTrophiesElement(options);
    feedback.appendChild(trophies);
  }
  if (feedbackBlocks.div) {
    feedback.appendChild(feedbackBlocks.div);
  }
  if (sharingDiv) {
    feedback.appendChild(sharingDiv);
  }
  if (showCode) {
    feedback.appendChild(showCode);
  }
  var canContinue = exports.canContinueToNextLevel(options.feedbackType);
  feedback.appendChild(getFeedbackButtons(
    options.feedbackType, options.level.showPreviousLevelButton));

  var againButton = feedback.querySelector('#again-button');
  var previousLevelButton = feedback.querySelector('#back-button');
  var continueButton = feedback.querySelector('#continue-button');

  var onlyContinue = continueButton && !againButton && !previousLevelButton;

  var onHidden = onlyContinue ? options.onContinue : null;
  var icon = canContinue ? BlocklyApps.WIN_ICON : BlocklyApps.FAILURE_ICON;
  var defaultBtnSelector = onlyContinue ? '#continue-button' : '#again-button';

  var feedbackDialog = exports.createModalDialogWithIcon({
    Dialog: options.Dialog,
    contentDiv: feedback,
    icon: icon,
    defaultBtnSelector: defaultBtnSelector,
    onHidden: onHidden
  });

  if (againButton) {
    dom.addClickTouchEvent(againButton, function() {
      feedbackDialog.hide();
    });
  }

  if (previousLevelButton) {
    dom.addClickTouchEvent(previousLevelButton, function() {
      feedbackDialog.hide();
      options.backToPreviousLevel();
    });
  }

  if (continueButton) {
    dom.addClickTouchEvent(continueButton, function() {
      feedbackDialog.hide();
      // onContinue will fire already if there was only a continue button
      if (!onlyContinue) {
        options.onContinue();
      }
    });
  }

  feedbackDialog.show({
    staticBackdrop: (options.app === 'flappy')
  });

  if (feedbackBlocks.div) {
    feedbackBlocks.show();
  }
};

/**
 * Counts the number of blocks used.  Blocks are only counted if they are
 * not disabled, are deletable.
 * @return {number} Number of blocks used.
 */
exports.getNumBlocksUsed = function() {
  var i;
  if (BlocklyApps.editCode) {
    var codeLines = 0;
    // quick and dirty method to count non-blank lines that don't start with //
    var lines = getGeneratedCodeString().split("\n");
    for (i = 0; i < lines.length; i++) {
      if ((lines[i].length > 1) && (lines[i][0] != '/' || lines[i][1] != '/')) {
        codeLines++;
      }
    }
    return codeLines;
  }
  return getUserBlocks().length;
};

/**
 * Counts the number of given blocks.  Blocks are only counted if they are
 * disabled or are deletable.
 * @return {number} Number of given blocks.
 */
exports.getNumGivenBlocks = function() {
  var i;
  if (BlocklyApps.editCode) {
    // When we are in edit mode, we can no longer tell which lines are given,
    // and which lines are edited. Returning zero here.
    return 0;
  }
  return getGivenBlocks().length;
};

var getFeedbackButtons = function(feedbackType, showPreviousLevelButton) {
  var buttons = document.createElement('div');
  buttons.innerHTML = require('./templates/buttons.html')({
    data: {
      previousLevel:
        !exports.canContinueToNextLevel(feedbackType) &&
        showPreviousLevelButton,
      tryAgain: feedbackType !== BlocklyApps.TestResults.ALL_PASS,
      nextLevel: exports.canContinueToNextLevel(feedbackType)
    }
  });

  return buttons;
};

var getFeedbackMessage = function(options) {
  var feedback = document.createElement('p');
  feedback.className = 'congrats';
  var message;
  switch (options.feedbackType) {
    case BlocklyApps.TestResults.EMPTY_BLOCK_FAIL:
      message = msg.emptyBlocksErrorMsg();
      break;
    case BlocklyApps.TestResults.TOO_FEW_BLOCKS_FAIL:
      message = options.level.tooFewBlocksMsg || msg.tooFewBlocksMsg();
      break;
    case BlocklyApps.TestResults.LEVEL_INCOMPLETE_FAIL:
      message = options.level.levelIncompleteError ||
          msg.levelIncompleteError();
      break;
    // For completing level, user gets at least one star.
    case BlocklyApps.TestResults.OTHER_1_STAR_FAIL:
      message = options.level.other1StarError || options.message;
      break;
    // Two stars for using too many blocks.
    case BlocklyApps.TestResults.TOO_MANY_BLOCKS_FAIL:
      message = msg.numBlocksNeeded({
        numBlocks: BlocklyApps.IDEAL_BLOCK_NUM,
        puzzleNumber: options.level.puzzle_number || 0
      });
      break;
    case BlocklyApps.TestResults.OTHER_2_STAR_FAIL:
      message = msg.tooMuchWork();
      break;
    case BlocklyApps.TestResults.FLAPPY_SPECIFIC_FAIL:
      message = msg.flappySpecificFail();
      break;
    case BlocklyApps.TestResults.MISSING_BLOCK_UNFINISHED:
      /* fallthrough */
    case BlocklyApps.TestResults.MISSING_BLOCK_FINISHED:
      message = msg.missingBlocksErrorMsg();
      break;
    case BlocklyApps.TestResults.ALL_PASS:
      var finalLevel = (options.response &&
          (options.response.message == "no more levels"));
      var stageCompleted = 0;
      if (options.response && options.response.stage_changing) {
        stageCompleted = options.response.stage_changing.previous.number;
      }
      var msgParams = {
        numTrophies: options.numTrophies,
        stageNumber: stageCompleted,
        puzzleNumber: options.level.puzzle_number || 0
      };
      if (options.numTrophies > 0) {
        message = finalLevel ? msg.finalStageTrophies(msgParams) :
                               stageCompleted ?
                                  msg.nextStageTrophies(msgParams) :
                                  msg.nextLevelTrophies(msgParams);
      } else {
        message = finalLevel ? msg.finalStage(msgParams) :
                               stageCompleted ?
                                   msg.nextStage(msgParams) :
                                   msg.nextLevel(msgParams);
      }
      break;
    // Free plays
    case BlocklyApps.TestResults.FREE_PLAY:
      message = options.instructionImageUrl ?
          msg.reinfFeedbackMsgWithImage() : msg.reinfFeedbackMsg();

      // would prefer a cleaner solution that doesnt special case flappy here,
      // but this will work for now.
      if (options.app === "flappy") {
        message = msg.reinfFeedbackMsgFlappy();
      }
      break;
  }
  dom.setText(feedback, message);
  return feedback;
};

exports.createSharingButtons = function(options) {
  var sharingWrapper = document.createElement('div');
  var sharingButtons = document.createElement('div');
  var sharingUrl = document.createElement('div');
  sharingButtons.className = 'social-buttons';
  sharingUrl.className = 'feedback-links';
  sharingUrl.innerHTML = require('./templates/buttons.html')({
    data: {
      sharingUrl: options.response.level_source
    }
  });

  var twitterUrl = "https://twitter.com/intent/tweet?url=" +
                   options.response.level_source;

  if (options.twitter && options.twitter.text !== undefined) {
    twitterUrl += "&text=" + encodeURI(options.twitter.text);
  }
  if (options.twitter  && options.twitter.hashtag !== undefined) {
    twitterUrl += "&button_hashtag=" + options.twitter.hashtag;
  }

  sharingButtons.innerHTML = require('./templates/buttons.html')({
    data: {
      facebookUrl: "https://www.facebook.com/sharer/sharer.php?u=" +
                    options.response.level_source,
      twitterUrl: twitterUrl,
      makeYourOwn: options.makeYourOwn
    }
  });
  var sharingInput = sharingUrl.querySelector('#sharing-input');
  if (sharingInput) {
    dom.addClickTouchEvent(sharingInput, function() {
      sharingInput.focus();
      sharingInput.select();
    });
  }
  sharingWrapper.appendChild(sharingUrl);
  sharingWrapper.appendChild(sharingButtons);
  return sharingWrapper;
};


var createSharingDiv = function(options) {
  // Creates the sharing div only when showingShring is set and the solution is
  // a passing solution.
  if (options.showingSharing &&
      exports.canContinueToNextLevel(options.feedbackType)) {
    var sharingDiv = document.createElement('div');
    sharingDiv.className = 'shareDiv';
    var sharingImage = document.createElement('div');

    var feedbackImage = createFeedbackImage(options);
    if (feedbackImage) {
        sharingImage.appendChild(feedbackImage);
        sharingDiv.appendChild(sharingImage);
    }

    if (options.response && options.response.level_source) {
      var sharingText = document.createElement('div');
      if (options.app === "flappy") {
        dom.setText(sharingText, msg.shareGame());
      } else {
        dom.setText(sharingText, msg.shareDrawing());
      }
      sharingText.className = 'shareDrawingMsg';
      sharingDiv.appendChild(sharingText);

      sharingDiv.appendChild(exports.createSharingButtons(options));
    }
    return sharingDiv;
  } else {
    return null;
  }
};

var createFeedbackImage = function(options) {
  var feedbackImage;
  var feedbackImageSrc =
      options.level.instructionImageUrl || options.feedbackImage;
  if (feedbackImageSrc) {
    feedbackImage = document.createElement('img');
    feedbackImage.className = 'feedback-image';
    feedbackImage.src = feedbackImageSrc;
  }
  return feedbackImage;
};

var numTrophiesEarned = function(options) {
  if (options.response && options.response.trophy_updates) {
    return options.response.trophy_updates.length;
  } else {
    return 0;
  }
};

var getTrophiesElement = function(options) {
  var html = "";
  for (var i = 0; i < options.numTrophies; i++) {
    html += trophy({
      img_url: options.response.trophy_updates[i][2],
      concept_name: options.response.trophy_updates[i][0]
    });
  }
  var trophies = document.createElement('div');
  trophies.innerHTML = html;
  return trophies;
};

var getShowCodeElement = function(options) {
  if (exports.canContinueToNextLevel(options.feedbackType)) {
    var linesWritten = exports.getNumBlocksUsed();
    var showCodeDiv = document.createElement('div');
    showCodeDiv.setAttribute('id', 'show-code');
    var lines = document.createElement('span');
    lines.className = 'linesOfCodeMsg';
    lines.innerHTML = msg.numLinesOfCodeWritten({
      numLines: linesWritten
    });
    if (options.response && options.response.total_lines &&
        (options.response.total_lines !== linesWritten)) {
      lines.innerHTML += '<br>' + msg.totalNumLinesOfCodeWritten({
        numLines: options.response.total_lines
      });
    }

    var showCodeLink = document.createElement('div');
    showCodeLink.className = 'show-code-div';
    showCodeLink.innerHTML = require('./templates/showCode.html')();
    var button = showCodeLink.querySelector('#show-code-button');

    button.addEventListener('click', function() {
      var codeDiv = getGeneratedCodeElement();
      showCodeDiv.appendChild(codeDiv);
      button.style.display = 'none';
    });

    // For now we want to hide lines of code for flappy app
    if (options.app === 'flappy') {
      lines.innerHTML = '<br>';
      showCodeDiv.appendChild(lines);
    } else {
      showCodeDiv.appendChild(lines);
      showCodeDiv.appendChild(showCodeLink);
    }

    return showCodeDiv;
  }
};

/**
 * Determines whether the user can proceed to the next level, based on the level feedback
 * @param {number} feedbackType A constant property of BlocklyApps.TestResults,
 *     typically produced by BlocklyApps.getTestResults().
 */
exports.canContinueToNextLevel = function(feedbackType) {
  return (feedbackType === BlocklyApps.TestResults.ALL_PASS ||
    feedbackType === BlocklyApps.TestResults.TOO_MANY_BLOCKS_FAIL ||
    feedbackType ===  BlocklyApps.TestResults.OTHER_2_STAR_FAIL ||
    feedbackType ===  BlocklyApps.TestResults.FREE_PLAY);
};

/**
 * Retrieve a string containing the user's generated Javascript code.
 */
var getGeneratedCodeString = function() {
  if (BlocklyApps.editCode) {
    var codeTextbox = document.getElementById('codeTextbox');
    return dom.getText(codeTextbox);
  }
  else {
    return codegen.workspaceCode(Blockly);
  }
};

var FeedbackBlocks = function(options) {
  var missingBlocks = getMissingRequiredBlocks();
  if (missingBlocks.length === 0) {
    return;
  }
  if (options.feedbackType !== BlocklyApps.TestResults.MISSING_BLOCK_UNFINISHED &&
      options.feedbackType !== BlocklyApps.TestResults.MISSING_BLOCK_FINISHED) {
    return;
  }

  this.div = document.createElement('div');
  this.html = readonly({
    app: options.app,
    assetUrl: BlocklyApps.assetUrl,
    options: {
      readonly: true,
      locale: BlocklyApps.LOCALE,
      localeDirection: BlocklyApps.localeDirection(),
      baseUrl: BlocklyApps.BASE_URL,
      cacheBust: BlocklyApps.CACHE_BUST,
      skinId: options.skin,
      blocks: generateXMLForBlocks(missingBlocks)
    }
  });
  this.iframe = document.createElement('iframe');
  this.iframe.setAttribute('id', 'feedbackBlocks');
  this.div.appendChild(this.iframe);
};

FeedbackBlocks.prototype.show = function() {
  var iframe = document.getElementById('feedbackBlocks');
  if (iframe) {
    var doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(this.html);
    doc.close();
  }
};

var getGeneratedCodeElement = function() {
  var infoMessage = BlocklyApps.editCode ?  "" : msg.generatedCodeInfo();
  var code = getGeneratedCodeString();

  var codeDiv = document.createElement('div');
  codeDiv.innerHTML = require('./templates/code.html')({
    message: infoMessage,
    code: code
  });

  return codeDiv;
};

exports.showGeneratedCode = function(Dialog) {
  var codeDiv = getGeneratedCodeElement();

  var buttons = document.createElement('div');
  buttons.innerHTML = require('./templates/buttons.html')({
    data: {
      ok: true
    }
  });
  codeDiv.appendChild(buttons);

  var dialog = exports.createModalDialogWithIcon({
      Dialog: Dialog,
      contentDiv: codeDiv,
      icon: BlocklyApps.ICON,
      defaultBtnSelector: '#ok-button'
      });

  var okayButton = buttons.querySelector('#ok-button');
  if (okayButton) {
    dom.addClickTouchEvent(okayButton, function() {
      dialog.hide();
    });
  }

  dialog.show();
};

/**
 * Check user's code for empty top-level blocks e.g. 'repeat'.
 * @return {boolean} true if block is empty (no blocks are nested inside).
 */
exports.hasEmptyTopLevelBlocks = function() {
  var code = codegen.workspaceCode(Blockly);
  return (/\{\s*\}/).test(code);
};

/**
 * Check whether the user code has all the blocks required for the level.
 * @return {boolean} true if all blocks are present, false otherwise.
 */
var hasAllRequiredBlocks = function() {
  return getMissingRequiredBlocks().length === 0;
};

/**
 * Get blocks that the user intends in the program, namely any that
 * are not disabled and can be deleted.
 * @return {Array<Object>} The blocks.
 */
var getUserBlocks = function() {
  var allBlocks = Blockly.mainWorkspace.getAllBlocks();
  var blocks = allBlocks.filter(function(block) {
    return !block.disabled && block.isDeletable();
  });
  return blocks;
};

/**
 * Get blocks that were given to the user in the program, namely any that
 * are disabled or cannot be deleted.
 * @return {Array<Object>} The blocks.
 */
var getGivenBlocks = function() {
  var allBlocks = Blockly.mainWorkspace.getAllBlocks();
  var blocks = allBlocks.filter(function(block) {
    return block.disabled || !block.isDeletable();
  });
  return blocks;
};

/**
 * Check to see if the user's code contains the required blocks for a level.
 * This never returns more than BlocklyApps.NUM_REQUIRED_BLOCKS_TO_FLAG.
 * @return {!Array} array of array of strings where each array of strings is
 * a set of blocks that at least one of them should be used. Each block is
 * represented as the prefix of an id in the corresponding template.soy.
 */
var getMissingRequiredBlocks = function() {
  var missingBlocks = [];
  var code = null;  // JavaScript code, which is initalized lazily.
  if (BlocklyApps.REQUIRED_BLOCKS && BlocklyApps.REQUIRED_BLOCKS.length) {
    var userBlocks = getUserBlocks();
    // For each list of required blocks
    // Keep track of the number of the missing block lists. It should not be
    // bigger than BlocklyApps.NUM_REQUIRED_BLOCKS_TO_FLAG
    var missingBlockNum = 0;
    for (var i = 0;
         i < BlocklyApps.REQUIRED_BLOCKS.length &&
             missingBlockNum < BlocklyApps.NUM_REQUIRED_BLOCKS_TO_FLAG;
         i++) {
      var blocks = BlocklyApps.REQUIRED_BLOCKS[i];
      // For each of the test
      // If at least one of the tests succeeded, we consider the required block
      // is used
      var usedRequiredBlock = false;
      for (var testId = 0; testId < blocks.length; testId++) {
        var test = blocks[testId].test;
        if (typeof test === 'string') {
          if (!code) {
            code = Blockly.Generator.workspaceToCode('JavaScript');
          }
          if (code.indexOf(test) !== -1) {
            // Succeeded, moving to the next list of tests
            usedRequiredBlock = true;
            break;
          }
        } else if (typeof test === 'function') {
          if (userBlocks.some(test)) {
            // Succeeded, moving to the next list of tests
            usedRequiredBlock = true;
            break;
          }
        } else {
          window.alert('Bad test: ' + test);
        }
      }
      if (!usedRequiredBlock) {
        missingBlockNum++;
        missingBlocks = missingBlocks.concat(BlocklyApps.REQUIRED_BLOCKS[i]);
      }
    }
  }
  return missingBlocks;
};

/**
 * Runs the tests and returns results.
 * @return {number} The appropriate property of BlocklyApps.TestResults.
 */
exports.getTestResults = function() {
  if (BlocklyApps.CHECK_FOR_EMPTY_BLOCKS && exports.hasEmptyTopLevelBlocks()) {
    return BlocklyApps.TestResults.EMPTY_BLOCK_FAIL;
  }
  if (!hasAllRequiredBlocks()) {
    if (BlocklyApps.levelComplete) {
      return BlocklyApps.TestResults.MISSING_BLOCK_FINISHED;
    } else {
      return BlocklyApps.TestResults.MISSING_BLOCK_UNFINISHED;
    }
  }
  var numBlocksUsed = exports.getNumBlocksUsed();
  if (!BlocklyApps.levelComplete) {
    if (BlocklyApps.IDEAL_BLOCK_NUM &&
        numBlocksUsed < BlocklyApps.IDEAL_BLOCK_NUM) {
      return BlocklyApps.TestResults.TOO_FEW_BLOCKS_FAIL;
    }
    return BlocklyApps.TestResults.LEVEL_INCOMPLETE_FAIL;
  }
  if (BlocklyApps.IDEAL_BLOCK_NUM &&
      numBlocksUsed > BlocklyApps.IDEAL_BLOCK_NUM) {
    return BlocklyApps.TestResults.TOO_MANY_BLOCKS_FAIL;
  } else {
    return BlocklyApps.TestResults.ALL_PASS;
  }
};

Keycodes = {
  ENTER: 13,
  SPACE: 32
};

exports.createModalDialogWithIcon = function(options) {
  var imageDiv = document.createElement('img');
  imageDiv.className = "modal-image";
  imageDiv.src = options.icon;

  var modalBody = document.createElement('div');
  modalBody.appendChild(imageDiv);
  options.contentDiv.className += ' modal-content';
  modalBody.appendChild(options.contentDiv);

  var btn = options.contentDiv.querySelector(options.defaultBtnSelector);
  var keydownHandler = function(e) {
    if (e.keyCode == Keycodes.ENTER || e.keyCode == Keycodes.SPACE) {
      Blockly.fireUiEvent(btn, 'click');
      e.stopPropagation();
      e.preventDefault();
    }
  };

  return new options.Dialog({
    body: modalBody,
    onHidden: options.onHidden,
    onKeydown: btn ? keydownHandler : undefined
  });
};

/**
 * Creates the XML for blocks to be displayed in a read-only frame.
 * @param {Array} blocks An array of blocks to display (with optional args).
 * @return {string} The generated string of XML.
 */
var generateXMLForBlocks = function(blocks) {
  var blockXMLStrings = [];
  var blockX = 10;  // Prevent left output plugs from being cut off.
  var blockY = 0;
  var blockXPadding = 200;
  var blockYPadding = 120;
  var blocksPerLine = 2;
  var k, name;
  for (var i = 0; i < blocks.length; i++) {
    var block = blocks[i];
    blockXMLStrings.push('<block', ' type="', block.type, '" x="',
                        blockX.toString(), '" y="', blockY, '">');
    if (block.titles) {
      var titleNames = Object.keys(block.titles);
      for (k = 0; k < titleNames.length; k++) {
        name = titleNames[k];
        blockXMLStrings.push('<title name="', name, '">',
                            block.titles[name], '</title>');
      }
    }
    if (block.values) {
      var valueNames = Object.keys(block.values);
      for (k = 0; k < valueNames.length; k++) {
        name = valueNames[k];
        blockXMLStrings.push('<value name="', name, '">',
                            block.values[name], '</value>');
      }
    }
    if (block.extra) {
      blockXMLStrings.push(block.extra);
    }
    blockXMLStrings.push('</block>');
    if ((i + 1) % blocksPerLine === 0) {
      blockY += blockYPadding;
      blockX = 0;
    } else {
      blockX += blockXPadding;
    }
  }
  return blockXMLStrings.join('');
};

},{"../locale/en_us/common":30,"./codegen":4,"./dom":5,"./templates/buttons.html":19,"./templates/code.html":20,"./templates/readonly.html":25,"./templates/showCode.html":26,"./templates/trophy.html":27,"./utils":28}],7:[function(require,module,exports){
var tiles = require('./tiles');
var Direction = tiles.Direction;
var SquareType = tiles.SquareType;

exports.FlapHeight = {
  VERY_SMALL: -6,
  SMALL: -8,
  NORMAL: -11,
  LARGE: -13,
  VERY_LARGE: -15
};

exports.LevelSpeed = {
  VERY_SLOW: 1,
  SLOW: 3,
  NORMAL: 4,
  FAST: 6,
  VERY_FAST: 8
};

exports.GapHeight = {
  VERY_SMALL: 75,
  SMALL: 100,
  NORMAL: 125,
  LARGE: 150,
  VERY_LARGE: 175
};

exports.random = function (values) {
  var key = Math.floor(Math.random() * values.length); 
  return values[key];
};

exports.setGround = function (id, value) {
  BlocklyApps.highlight(id);
  Flappy.setGround(value);
};

exports.setObstacle = function (id, value) {
  BlocklyApps.highlight(id);
  Flappy.setObstacle(value);
};

exports.setPlayer = function (id, value) {
  BlocklyApps.highlight(id);
  Flappy.setPlayer(value);
};

exports.setGapHeight = function (id, value) {
  BlocklyApps.highlight(id);
  Flappy.setGapHeight(value);
};

exports.setBackground = function (id, value) {
  BlocklyApps.highlight(id);
  Flappy.setBackground(value);
};

exports.setSpeed = function (id, value) {
  BlocklyApps.highlight(id);
  Flappy.SPEED = value;
};

exports.playSound = function(id, soundName) {
  BlocklyApps.highlight(id);
  BlocklyApps.playAudio(soundName, {volume: 0.5});
};

exports.flap = function (id, amount) {
  BlocklyApps.highlight(id);
  Flappy.flap(amount);
};

exports.endGame = function (id) {
  BlocklyApps.highlight(id);
  Flappy.gameState = Flappy.GameStates.ENDING;
};

exports.incrementPlayerScore = function(id) {
  BlocklyApps.highlight(id);
  Flappy.playerScore++;
  Flappy.displayScore();
};

},{"./tiles":14}],8:[function(require,module,exports){
/**
 * Blockly App: Bounce
 *
 * Copyright 2013 Code.org
 *
 */
'use strict';

var msg = require('../../locale/en_us/flappy');
var codegen = require('../codegen');

var generateSetterCode = function (ctx, name) {
  var value = ctx.getTitleValue('VALUE');
  if (value === "random") {
    var allValues = ctx.VALUES.slice(1).map(function (item) {
      return item[1];
    });
    value = 'Flappy.random([' + allValues + '])';
  }

  return 'Flappy.' + name + '(\'block_id_' + ctx.id + '\', ' +
    value + ');\n';
};

// Install extensions to Blockly's language and JavaScript generator.
exports.install = function(blockly, skin) {

  var generator = blockly.Generator.get('JavaScript');
  blockly.JavaScript = generator;

  blockly.Blocks.flappy_whenClick = {
    // Block to handle event where mouse is clicked
    helpUrl: '',
    init: function () {
      this.setHSV(140, 1.00, 0.74);
      this.appendDummyInput()
        .appendTitle(msg.whenClick());
      this.setPreviousStatement(false);
      this.setNextStatement(true);
      this.setTooltip(msg.whenClickTooltip());
    }
  };

  generator.flappy_whenClick = function () {
    // Generate JavaScript for handling click event.
    return '\n';
  };

  blockly.Blocks.flappy_whenCollideGround = {
    // Block to handle event where flappy hits ground
    helpUrl: '',
    init: function () {
      this.setHSV(140, 1.00, 0.74);
      this.appendDummyInput()
        .appendTitle(msg.whenCollideGround());
      this.setPreviousStatement(false);
      this.setNextStatement(true);
      this.setTooltip(msg.whenCollideGroundTooltip());
    }
  };

  generator.flappy_whenCollideGround = function () {
    // Generate JavaScript for handling click event.
    return '\n';
  };

  blockly.Blocks.flappy_whenCollideObstacle = {
    // Block to handle event where flappy hits a Obstacle
    helpUrl: '',
    init: function () {
      this.setHSV(140, 1.00, 0.74);
      this.appendDummyInput()
        .appendTitle(msg.whenCollideObstacle());
      this.setPreviousStatement(false);
      this.setNextStatement(true);
      this.setTooltip(msg.whenCollideObstacleTooltip());
    }
  };

  generator.flappy_whenCollideObstacle = function () {
    // Generate JavaScript for handling collide Obstacle event.
    return '\n';
  };

  blockly.Blocks.flappy_whenEnterObstacle = {
    // Block to handle event where flappy enters a Obstacle
    helpUrl: '',
    init: function () {
      this.setHSV(140, 1.00, 0.74);
      this.appendDummyInput()
        .appendTitle(msg.whenEnterObstacle());
      this.setPreviousStatement(false);
      this.setNextStatement(true);
      this.setTooltip(msg.whenEnterObstacleTooltip());
    }
  };

  generator.flappy_whenEnterObstacle = function () {
    // Generate JavaScript for handling enter Obstacle.
    return '\n';
  };

  generator.flappy_whenRunButtonClick = function () {
    // Generate JavaScript for handling run button click.
    return '\n';
  };

  blockly.Blocks.flappy_whenRunButtonClick = {
    // Block to handle event where run button is clicked
    helpUrl: '',
    init: function () {
      this.setHSV(140, 1.00, 0.74);
      this.appendDummyInput()
        .appendTitle(msg.whenRunButtonClick());
      this.setPreviousStatement(false);
      this.setNextStatement(true);
      this.setTooltip(msg.whenRunButtonClickTooltip());
    }
  };

  generator.flappy_whenRunButtonClick = function () {
    // Generate JavaScript for handling run button click
    return '\n';
  };

  blockly.Blocks.flappy_flap = {
    // Block for flapping (flying upwards)
    helpUrl: '',
    init: function() {
      this.setHSV(184, 1.00, 0.74);
      this.appendDummyInput()
        .appendTitle(msg.flap());
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.flapTooltip());
    }
  };

  generator.flappy_flap = function (velocity) {
    // Generate JavaScript for moving left.
    return 'Flappy.flap(\'block_id_' + this.id + '\');\n';
  };

  blockly.Blocks.flappy_flap_height = {
    // Block for flapping (flying upwards)
    helpUrl: '',
    init: function() {
      var dropdown = new blockly.FieldDropdown(this.VALUES);
      dropdown.setValue(this.VALUES[3][1]); // default to normal

      this.setHSV(184, 1.00, 0.74);
      this.appendDummyInput()
          .appendTitle(dropdown, 'VALUE');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.flapTooltip());
    }
  };

  blockly.Blocks.flappy_flap_height.VALUES =
      [[msg.flapRandom(), 'random'],
       [msg.flapVerySmall(), 'Flappy.FlapHeight.VERY_SMALL'],
       [msg.flapSmall(), 'Flappy.FlapHeight.SMALL'],
       [msg.flapNormal(), 'Flappy.FlapHeight.NORMAL'],
       [msg.flapLarge(), 'Flappy.FlapHeight.LARGE'],
       [msg.flapVeryLarge(), 'Flappy.FlapHeight.VERY_LARGE']];

  generator.flappy_flap_height = function (velocity) {
    return generateSetterCode(this, 'flap');
  };

  blockly.Blocks.flappy_playSound = {
    // Block for playing sound.
    helpUrl: '',
    init: function() {
      var dropdown = new blockly.FieldDropdown(this.VALUES);
      dropdown.setValue(this.VALUES[7][1]);
      this.setHSV(184, 1.00, 0.74);
      this.appendDummyInput()
          .appendTitle(dropdown, 'VALUE');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.playSoundTooltip());
    }
  };

  blockly.Blocks.flappy_playSound.VALUES =
      [[msg.playSoundRandom(), 'random'],
       [msg.playSoundBounce(), '"wall"'],
       [msg.playSoundCrunch(), '"wall0"'],
       [msg.playSoundDie(), '"sfx_die"'],
       [msg.playSoundHit(), '"sfx_hit"'],
       [msg.playSoundPoint(), '"sfx_point"'],
       [msg.playSoundSwoosh(), '"sfx_swooshing"'],
       [msg.playSoundWing(), '"sfx_wing"'],
       [msg.playSoundJet(), '"jet"'],
       [msg.playSoundCrash(), '"crash"'],
       [msg.playSoundJingle(), '"jingle"'],
       [msg.playSoundSplash(), '"splash"'],
       [msg.playSoundLaser(), '"laser"']
     ];

  generator.flappy_playSound = function() {
    return generateSetterCode(this, 'playSound');
  };

  blockly.Blocks.flappy_incrementPlayerScore = {
    // Block for incrementing the player's score.
    helpUrl: '',
    init: function() {
      this.setHSV(184, 1.00, 0.74);
      this.appendDummyInput()
        .appendTitle(msg.incrementPlayerScore());
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.incrementPlayerScoreTooltip());
    }
  };

  generator.flappy_incrementPlayerScore = function() {
    // Generate JavaScript for incrementing the player's score.
    return 'Flappy.incrementPlayerScore(\'block_id_' + this.id + '\');\n';
  };

  blockly.Blocks.flappy_endGame = {
    helpUrl: '',
    init: function() {
      this.setHSV(184, 1.00, 0.74);
      this.appendDummyInput()
        .appendTitle(msg.endGame());
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.endGameTooltip());
    }
  };

  generator.flappy_endGame = function() {
    // Generate JavaScript for incrementing the player's score.
    return 'Flappy.endGame(\'block_id_' + this.id + '\');\n';
  };

  /**
   * setSpeed
   */
  blockly.Blocks.flappy_setSpeed = {
    helpUrl: '',
    init: function() {
      var dropdown = new blockly.FieldDropdown(this.VALUES);
      dropdown.setValue(this.VALUES[3][1]);  // default to normal

      this.setHSV(312, 0.32, 0.62);
      this.appendDummyInput()
          .appendTitle(dropdown, 'VALUE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.setSpeedTooltip());
    }
  };

  blockly.Blocks.flappy_setSpeed.VALUES =
      [[msg.speedRandom(), 'random'],
       [msg.speedVerySlow(), 'Flappy.LevelSpeed.VERY_SLOW'],
       [msg.speedSlow(), 'Flappy.LevelSpeed.SLOW'],
       [msg.speedNormal(), 'Flappy.LevelSpeed.NORMAL'],
       [msg.speedFast(), 'Flappy.LevelSpeed.FAST'],
       [msg.speedVeryFast(), 'Flappy.LevelSpeed.VERY_FAST']];

  generator.flappy_setSpeed = function() {
    return generateSetterCode(this, 'setSpeed');
  };

  /**
   * setGapHeight
   */
  blockly.Blocks.flappy_setGapHeight = {
    helpUrl: '',
    init: function() {
      var dropdown = new blockly.FieldDropdown(this.VALUES);
      dropdown.setValue(this.VALUES[3][1]);  // default to normal

      this.setHSV(312, 0.32, 0.62);
      this.appendDummyInput()
          .appendTitle(dropdown, 'VALUE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.setGapHeightTooltip());
    }
  };

  blockly.Blocks.flappy_setGapHeight.VALUES =
      [[msg.setGapRandom(), 'random'],
       [msg.setGapVerySmall(), 'Flappy.GapHeight.VERY_SMALL'],
       [msg.setGapSmall(), 'Flappy.GapHeight.SMALL'],
       [msg.setGapNormal(), 'Flappy.GapHeight.NORMAL'],
       [msg.setGapLarge(), 'Flappy.GapHeight.LARGE'],
       [msg.setGapVeryLarge(), 'Flappy.GapHeight.VERY_LARGE']];

  generator.flappy_setGapHeight = function() {
    return generateSetterCode(this, 'setGapHeight');
  };

  /**
   * setBackground
   */
  blockly.Blocks.flappy_setBackground = {
    helpUrl: '',
    init: function() {
      var dropdown = new blockly.FieldDropdown(this.VALUES);
      dropdown.setValue(this.VALUES[1][1]);  // default to flappy

      this.setHSV(312, 0.32, 0.62);
      this.appendDummyInput()
          .appendTitle(dropdown, 'VALUE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.setBackgroundTooltip());
    }
  };

  blockly.Blocks.flappy_setBackground.VALUES =
      [[msg.setBackgroundRandom(), 'random'],
       [msg.setBackgroundFlappy(), '"flappy"'],
       [msg.setBackgroundNight(), '"night"'],
       [msg.setBackgroundSciFi(), '"scifi"'],
       [msg.setBackgroundUnderwater(), '"underwater"'],
       [msg.setBackgroundCave(), '"cave"'],
       [msg.setBackgroundSanta(), '"santa"']];

  generator.flappy_setBackground = function() {
    return generateSetterCode(this, 'setBackground');
  };

  /**
   * setPlayer
   */
  blockly.Blocks.flappy_setPlayer = {
    helpUrl: '',
    init: function() {
      var dropdown = new blockly.FieldDropdown(this.VALUES);
      dropdown.setValue(this.VALUES[1][1]);  // default to flappy

      this.setHSV(312, 0.32, 0.62);
      this.appendDummyInput()
          .appendTitle(dropdown, 'VALUE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.setPlayerTooltip());
    }
  };

  blockly.Blocks.flappy_setPlayer.VALUES =
      [[msg.setPlayerRandom(), 'random'],
       [msg.setPlayerFlappy(), '"flappy"'],
       [msg.setPlayerRedBird(), '"redbird"'],
       [msg.setPlayerSciFi(), '"scifi"'],
       [msg.setPlayerUnderwater(), '"underwater"'],
       [msg.setPlayerSanta(), '"santa"'],
       [msg.setPlayerCave(), '"cave"'],
       [msg.setPlayerShark(), '"shark"'],
       [msg.setPlayerEaster(), '"easter"'],
       [msg.setPlayerBatman(), '"batman"'],
       [msg.setPlayerSubmarine(), '"submarine"'],
       [msg.setPlayerUnicorn(), '"unicorn"'],
       [msg.setPlayerFairy(), '"fairy"'],
       [msg.setPlayerSuperman(), '"superman"'],
       [msg.setPlayerTurkey(), '"turkey"']];

  generator.flappy_setPlayer = function() {
    return generateSetterCode(this, 'setPlayer');
  };

  /**
   * setObstacle
   */
  blockly.Blocks.flappy_setObstacle = {
    helpUrl: '',
    init: function() {
      var dropdown = new blockly.FieldDropdown(this.VALUES);
      dropdown.setValue(this.VALUES[1][1]);  // default to flappy

      this.setHSV(312, 0.32, 0.62);
      this.appendDummyInput()
          .appendTitle(dropdown, 'VALUE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.setObstacleTooltip());
    }
  };

  blockly.Blocks.flappy_setObstacle.VALUES =
      [[msg.setObstacleRandom(), 'random'],
       [msg.setObstacleFlappy(), '"flappy"'],
       [msg.setObstacleSciFi(), '"scifi"'],
       [msg.setObstacleUnderwater(), '"underwater"'],
       [msg.setObstacleCave(), '"cave"'],
       [msg.setObstacleSanta(), '"santa"'],
       [msg.setObstacleLaser(), '"laser"']];

  generator.flappy_setObstacle = function() {
    return generateSetterCode(this, 'setObstacle');
  };

  /**
   * setGround
   */
  blockly.Blocks.flappy_setGround = {
    helpUrl: '',
    init: function() {
      var dropdown = new blockly.FieldDropdown(this.VALUES);
      dropdown.setValue(this.VALUES[1][1]);  // default to flappy

      this.setHSV(312, 0.32, 0.62);
      this.appendDummyInput()
          .appendTitle(dropdown, 'VALUE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.setGroundTooltip());
    }
  };

  blockly.Blocks.flappy_setGround.VALUES =
      [[msg.setGroundRandom(), 'random'],
       [msg.setGroundFlappy(), '"flappy"'],
       [msg.setGroundSciFi(), '"scifi"'],
       [msg.setGroundUnderwater(), '"underwater"'],
       [msg.setGroundCave(), '"cave"'],
       [msg.setGroundSanta(), '"santa"'],
       [msg.setGroundLava(), '"lava"']];

  generator.flappy_setGround = function() {
    return generateSetterCode(this, 'setGround');
  };

  delete blockly.Blocks.procedures_defreturn;
  delete blockly.Blocks.procedures_ifreturn;
};

},{"../../locale/en_us/flappy":31,"../codegen":4}],9:[function(require,module,exports){
module.exports= (function() {
  var t = function anonymous(locals, filters, escape, rethrow) {
escape = escape || function (html){
  return String(html)
    .replace(/&(?!#?[a-zA-Z0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
};
var buf = [];
with (locals || {}) { (function(){ 
 buf.push('');1; var msg = require('../../locale/en_us/flappy') ; buf.push('\n\n<td id="share-cell" class="share-cell-none">\n  <button id="shareButton" class="share">\n    <img src="', escape((5,  assetUrl('media/1x1.gif') )), '">\n    ', escape((6,  msg.share() )), '\n  </button>\n</td>'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"../../locale/en_us/flappy":31,"ejs":32}],10:[function(require,module,exports){
/**
 * Blockly App: Flappy
 *
 * Copyright 2013 Code.org
 *
 */

'use strict';

var BlocklyApps = require('../base');
var commonMsg = require('../../locale/en_us/common');
var flappyMsg = require('../../locale/en_us/flappy');
var skins = require('../skins');
var tiles = require('./tiles');
var codegen = require('../codegen');
var api = require('./api');
var page = require('../templates/page.html');
var feedback = require('../feedback.js');
var dom = require('../dom');

var SquareType = tiles.SquareType;

/**
 * Create a namespace for the application.
 */
var Flappy = module.exports;

Flappy.GameStates = {
  WAITING: 0,
  ACTIVE: 1,
  ENDING: 2,
  OVER: 3
};

Flappy.gameState = Flappy.GameStates.WAITING;

Flappy.clickPending = false;

Flappy.avatarVelocity = 0;
Flappy.gravity = 1;

var level;
var skin;
var onSharePage;

Flappy.obstacles = [];

/**
 * Milliseconds between each animation frame.
 */
var stepSpeed;

// whether to show Get Ready and Game Over
var infoText;

//TODO: Make configurable.
BlocklyApps.CHECK_FOR_EMPTY_BLOCKS = true;

var randomObstacleHeight = function () {
  var min = Flappy.MIN_OBSTACLE_HEIGHT;
  var max = Flappy.MAZE_HEIGHT - Flappy.GROUND_HEIGHT - Flappy.MIN_OBSTACLE_HEIGHT - Flappy.GAP_SIZE;
  return Math.floor((Math.random() * (max - min)) + min);
};

//The number of blocks to show as feedback.
BlocklyApps.NUM_REQUIRED_BLOCKS_TO_FLAG = 1;

// Default Scalings
Flappy.scale = {
  'snapRadius': 1,
  'stepSpeed': 33
};

var twitterOptions = {
  text: flappyMsg.shareFlappyTwitter(),
  hashtag: "FlappyCode"
};

var loadLevel = function() {
  // Load maps.
  BlocklyApps.IDEAL_BLOCK_NUM = level.ideal || Infinity;
  BlocklyApps.REQUIRED_BLOCKS = level.requiredBlocks;

  infoText = (level.infoText === undefined ? true : level.infoText);
  if (!infoText) {
    Flappy.gameState = Flappy.GameStates.ACTIVE;
  }

  // Override scalars.
  for (var key in level.scale) {
    Flappy.scale[key] = level.scale[key];
  }

  // Measure maze dimensions and set sizes.
  Flappy.AVATAR_HEIGHT = skin.pegmanHeight;
  Flappy.AVATAR_WIDTH = skin.pegmanWidth;
  Flappy.AVATAR_Y_OFFSET = skin.pegmanYOffset;
  // Height and width of the goal and obstacles.
  Flappy.MARKER_HEIGHT = 43;
  Flappy.MARKER_WIDTH = 50;

  Flappy.MAZE_WIDTH = 400;
  Flappy.MAZE_HEIGHT = 400;

  Flappy.GROUND_WIDTH = 400;
  Flappy.GROUND_HEIGHT = 48;

  Flappy.GOAL_SIZE = 55;

  Flappy.OBSTACLE_WIDTH = 52;
  Flappy.OBSTACLE_HEIGHT = 320;
  Flappy.MIN_OBSTACLE_HEIGHT = 48;

  Flappy.setGapHeight(api.GapHeight.NORMAL);

  Flappy.OBSTACLE_SPACING = 250; // number of horizontal pixels between the start of obstacles

  var numObstacles = 2 * Flappy.MAZE_WIDTH / Flappy.OBSTACLE_SPACING;
  if (!level.obstacles) {
    numObstacles = 0;
  }

  var resetObstacle = function (x) {
    this.x = x;
    this.gapStart = randomObstacleHeight();
    this.hitAvatar = false;
  };

  var containsAvatar = function () {
    var flappyRight = Flappy.avatarX + Flappy.AVATAR_WIDTH;
    var flappyBottom = Flappy.avatarY + Flappy.AVATAR_HEIGHT;
    var obstacleRight = this.x + Flappy.OBSTACLE_WIDTH;
    var obstacleBottom = this.gapStart + Flappy.GAP_SIZE;
    return (flappyRight > this.x &&
      flappyRight < obstacleRight &&
      Flappy.avatarY > this.gapStart &&
      flappyBottom < obstacleBottom);
  };

  for (var i = 0; i < numObstacles; i++) {
    Flappy.obstacles.push({
      x: Flappy.MAZE_WIDTH * 1.5 + i * Flappy.OBSTACLE_SPACING,
      gapStart: randomObstacleHeight(), // y coordinate of the top of the gap
      hitAvatar: false,
      reset: resetObstacle,
      containsAvatar: containsAvatar
    });
  }
};

/**
 * PIDs of async tasks currently executing.
 */
Flappy.pidList = [];

var drawMap = function() {
  var svg = document.getElementById('svgFlappy');
  var i, x, y, k, tile;

  // Draw the outer square.
  var square = document.createElementNS(Blockly.SVG_NS, 'rect');
  square.setAttribute('width', Flappy.MAZE_WIDTH);
  square.setAttribute('height', Flappy.MAZE_HEIGHT);
  square.setAttribute('fill', '#F1EEE7');
  square.setAttribute('stroke-width', 1);
  square.setAttribute('stroke', '#CCB');
  svg.appendChild(square);

  // Adjust outer element size.
  svg.setAttribute('width', Flappy.MAZE_WIDTH);
  svg.setAttribute('height', Flappy.MAZE_HEIGHT);

  // Adjust visualization and belowVisualization width.
  var visualization = document.getElementById('visualization');
  visualization.style.width = Flappy.MAZE_WIDTH + 'px';
  var belowVisualization = document.getElementById('belowVisualization');
  belowVisualization.style.width = Flappy.MAZE_WIDTH + 'px';

  // Adjust button table width.
  var buttonTable = document.getElementById('gameButtons');
  buttonTable.style.width = Flappy.MAZE_WIDTH + 'px';

  var hintBubble = document.getElementById('bubble');
  hintBubble.style.width = Flappy.MAZE_WIDTH + 'px';

  if (skin.background) {
    tile = document.createElementNS(Blockly.SVG_NS, 'image');
    tile.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
                        skin.background);
    tile.setAttribute('id', 'background');
    tile.setAttribute('height', Flappy.MAZE_HEIGHT);
    tile.setAttribute('width', Flappy.MAZE_WIDTH);
    tile.setAttribute('x', 0);
    tile.setAttribute('y', 0);
    svg.appendChild(tile);
  }

  // Add obstacles
  Flappy.obstacles.forEach (function (obstacle, index) {
    var obstacleTopIcon = document.createElementNS(Blockly.SVG_NS, 'image');
    obstacleTopIcon.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
                              skin.obstacle_top);
    obstacleTopIcon.setAttribute('id', 'obstacle_top' + index);
    obstacleTopIcon.setAttribute('height', Flappy.OBSTACLE_HEIGHT);
    obstacleTopIcon.setAttribute('width', Flappy.OBSTACLE_WIDTH);
    svg.appendChild(obstacleTopIcon);

    var obstacleBottomIcon = document.createElementNS(Blockly.SVG_NS, 'image');
    obstacleBottomIcon.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
                              skin.obstacle_bottom);
    obstacleBottomIcon.setAttribute('id', 'obstacle_bottom' + index);
    obstacleBottomIcon.setAttribute('height', Flappy.OBSTACLE_HEIGHT);
    obstacleBottomIcon.setAttribute('width', Flappy.OBSTACLE_WIDTH);
    svg.appendChild(obstacleBottomIcon);
  });

  if (level.ground) {
    for (i = 0; i < Flappy.MAZE_WIDTH / Flappy.GROUND_WIDTH + 1; i++) {
      var groundIcon = document.createElementNS(Blockly.SVG_NS, 'image');
      groundIcon.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
                              skin.ground);
      groundIcon.setAttribute('id', 'ground' + i);
      groundIcon.setAttribute('height', Flappy.GROUND_HEIGHT);
      groundIcon.setAttribute('width', Flappy.GROUND_WIDTH);
      groundIcon.setAttribute('x', 0);
      groundIcon.setAttribute('y', Flappy.MAZE_HEIGHT - Flappy.GROUND_HEIGHT);
      svg.appendChild(groundIcon);
    }
  }

  if (level.goal && level.goal.startX) {
    var goal = document.createElementNS(Blockly.SVG_NS, 'image');
    goal.setAttribute('id', 'goal');
    goal.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
                            skin.goal);
    goal.setAttribute('height', Flappy.GOAL_SIZE);
    goal.setAttribute('width', Flappy.GOAL_SIZE);
    goal.setAttribute('x', level.goal.startX);
    goal.setAttribute('y', level.goal.startY);
    svg.appendChild(goal);
  }

  var avatArclip = document.createElementNS(Blockly.SVG_NS, 'clipPath');
  avatArclip.setAttribute('id', 'avatArclipPath');
  var avatArclipRect = document.createElementNS(Blockly.SVG_NS, 'rect');
  avatArclipRect.setAttribute('id', 'avatArclipRect');
  avatArclipRect.setAttribute('width', Flappy.MAZE_WIDTH);
  avatArclipRect.setAttribute('height', Flappy.MAZE_HEIGHT - Flappy.GROUND_HEIGHT);
  avatArclip.appendChild(avatArclipRect);
  svg.appendChild(avatArclip);

  // Add avatar.
  var avatarIcon = document.createElementNS(Blockly.SVG_NS, 'image');
  avatarIcon.setAttribute('id', 'avatar');
  avatarIcon.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
                          skin.avatar);
  avatarIcon.setAttribute('height', Flappy.AVATAR_HEIGHT);
  avatarIcon.setAttribute('width', Flappy.AVATAR_WIDTH);
  if (level.ground) {
    avatarIcon.setAttribute('clip-path', 'url(#avatArclipPath)');
  }
  svg.appendChild(avatarIcon);

  var instructions = document.createElementNS(Blockly.SVG_NS, 'image');
  instructions.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
                              skin.instructions);
  instructions.setAttribute('id', 'instructions');
  instructions.setAttribute('height', 50);
  instructions.setAttribute('width', 159);
  instructions.setAttribute('x', 110);
  instructions.setAttribute('y', 170);
  instructions.setAttribute('visibility', 'hidden');
  svg.appendChild(instructions);

  var getready = document.createElementNS(Blockly.SVG_NS, 'image');
  getready.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
                              skin.getready);
  getready.setAttribute('id', 'getready');
  getready.setAttribute('height', 50);
  getready.setAttribute('width', 183);
  getready.setAttribute('x', 108);
  getready.setAttribute('y', 80);
  getready.setAttribute('visibility', 'hidden');
  svg.appendChild(getready);

  var clickrun = document.createElementNS(Blockly.SVG_NS, 'image');
  clickrun.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
                              skin.clickrun);
  clickrun.setAttribute('id', 'clickrun');
  clickrun.setAttribute('height', 41);
  clickrun.setAttribute('width', 273);
  clickrun.setAttribute('x', 64);
  clickrun.setAttribute('y', 200);
  clickrun.setAttribute('visibility', 'visibile');
  svg.appendChild(clickrun);

  var gameover = document.createElementNS(Blockly.SVG_NS, 'image');
  gameover.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
                              skin.gameover);
  gameover.setAttribute('id', 'gameover');
  gameover.setAttribute('height', 41);
  gameover.setAttribute('width', 192);
  gameover.setAttribute('x', 104);
  gameover.setAttribute('y', 80);
  gameover.setAttribute('visibility', 'hidden');
  svg.appendChild(gameover);

  var score = document.createElementNS(Blockly.SVG_NS, 'text');
  score.setAttribute('id', 'score');
  score.setAttribute('class', 'flappy-score');
  score.setAttribute('x', Flappy.MAZE_WIDTH / 2);
  score.setAttribute('y', 60);
  score.appendChild(document.createTextNode('0'));
  score.setAttribute('visibility', 'hidden');
  svg.appendChild(score);

  var clickRect = document.createElementNS(Blockly.SVG_NS, 'rect');
  clickRect.setAttribute('width', Flappy.MAZE_WIDTH);
  clickRect.setAttribute('height', Flappy.MAZE_HEIGHT);
  clickRect.setAttribute('fill-opacity', 0);
  clickRect.addEventListener('touchstart', function (e) {
    Flappy.onMouseDown(e);
    e.preventDefault(); // don't want to see mouse down
  });
  clickRect.addEventListener('mousedown', function (e) {
    Flappy.onMouseDown(e);
  });
  svg.appendChild(clickRect);
};

Flappy.calcDistance = function(xDist, yDist) {
  return Math.sqrt(xDist * xDist + yDist * yDist);
};

var essentiallyEqual = function(float1, float2, opt_variance) {
  var variance = opt_variance || 0.01;
  return (Math.abs(float1 - float2) < variance);
};

/**
 * @param scope Object :  The scope in which to execute the delegated function.
 * @param func Function : The function to execute
 * @param data Object or Array : The data to pass to the function. If the function is also passed arguments, the data is appended to the arguments list. If the data is an Array, each item is appended as a new argument.
 */
var delegate = function(scope, func, data)
{
  return function()
  {
    var args = Array.prototype.slice.apply(arguments).concat(data);
    func.apply(scope, args);
  };
};

/**
 * Check to see if avatar is in collision with given obstacle
 * @param obstacle Object : The obstacle object we're checking
 */
var checkForObstacleCollision = function (obstacle) {
  var insideObstacleColumn = Flappy.avatarX + Flappy.AVATAR_WIDTH >= obstacle.x &&
    Flappy.avatarX <= obstacle.x + Flappy.OBSTACLE_WIDTH;
  if (insideObstacleColumn && (Flappy.avatarY <= obstacle.gapStart ||
    Flappy.avatarY + Flappy.AVATAR_HEIGHT >= obstacle.gapStart + Flappy.GAP_SIZE)) {
    return true;
  }
  return false;
};

Flappy.activeTicks = function () {
  if (Flappy.firstActiveTick < 0) {
    return 0;
  }

  return (Flappy.tickCount - Flappy.firstActiveTick);
};

Flappy.onTick = function() {
  var avatarWasAboveGround, avatarIsAboveGround;

  if (Flappy.firstActiveTick < 0 && Flappy.gameState === Flappy.GameStates.ACTIVE) {
    Flappy.firstActiveTick = Flappy.tickCount;
  }

  Flappy.tickCount++;

  if (Flappy.tickCount === 1) {
    try { Flappy.whenRunButton(BlocklyApps, api); } catch (e) { }
  }

  // Check for click
  if (Flappy.clickPending && Flappy.gameState <= Flappy.GameStates.ACTIVE) {
    try { Flappy.whenClick(BlocklyApps, api); } catch (e) { }
    Flappy.clickPending = false;
  }

  avatarWasAboveGround = (Flappy.avatarY + Flappy.AVATAR_HEIGHT) <
    (Flappy.MAZE_HEIGHT - Flappy.GROUND_HEIGHT);

  // Action doesn't start until user's first click
  if (Flappy.gameState === Flappy.GameStates.ACTIVE) {
    // Update avatar's vertical position
    Flappy.avatarVelocity += Flappy.gravity;
    Flappy.avatarY = Flappy.avatarY + Flappy.avatarVelocity;

    // never let the avatar go too far off the top or bottom
    var bottomLimit = level.ground ?
      (Flappy.MAZE_HEIGHT - Flappy.GROUND_HEIGHT - Flappy.AVATAR_HEIGHT + 1) :
      (Flappy.MAZE_HEIGHT * 1.5);

    Flappy.avatarY = Math.min(Flappy.avatarY, bottomLimit);
    Flappy.avatarY = Math.max(Flappy.avatarY, Flappy.MAZE_HEIGHT * -0.5);

    // Update obstacles
    Flappy.obstacles.forEach(function (obstacle) {
      var wasRightOfAvatar = obstacle.x > (Flappy.avatarX + Flappy.AVATAR_WIDTH);

      obstacle.x -= Flappy.SPEED;

      var isRightOfAvatar = obstacle.x > (Flappy.avatarX + Flappy.AVATAR_WIDTH);
      if (wasRightOfAvatar && !isRightOfAvatar) {
        if (Flappy.avatarY > obstacle.gapStart &&
          (Flappy.avatarY + Flappy.AVATAR_HEIGHT < obstacle.gapStart + Flappy.GAP_SIZE)) {
          try { Flappy.whenEnterObstacle(BlocklyApps, api); } catch (e) { }
        }
      }

      if (!obstacle.hitAvatar && checkForObstacleCollision(obstacle)) {
        obstacle.hitAvatar = true;
        try {Flappy.whenCollideObstacle(BlocklyApps, api); } catch (e) { }
      }

      // If obstacle moves off left side, repurpose as a new obstacle to our right
      if (obstacle.x + Flappy.OBSTACLE_WIDTH < 0) {
        obstacle.reset(Flappy.obstacles.length * Flappy.OBSTACLE_SPACING);
      }
    });

    // check for ground collision
    avatarIsAboveGround = (Flappy.avatarY + Flappy.AVATAR_HEIGHT) <
      (Flappy.MAZE_HEIGHT - Flappy.GROUND_HEIGHT);
    if (avatarWasAboveGround && !avatarIsAboveGround) {
      try { Flappy.whenCollideGround(BlocklyApps, api); } catch (e) { }
    }

    // update goal
    if (level.goal && level.goal.moving) {
      Flappy.goalX -= Flappy.SPEED;
      if (Flappy.goalX + Flappy.GOAL_SIZE < 0) {
        // if it disappears off of left, reappear on right
        Flappy.goalX = Flappy.MAZE_WIDTH + Flappy.GOAL_SIZE;
      }
    }
  }

  if (Flappy.gameState === Flappy.GameStates.ENDING) {
    Flappy.avatarY += 10;

    // we use avatar width instead of height bc he is rotating
    // the extra 4 is so that he buries his beak (similar to mobile game)
    var max = Flappy.MAZE_HEIGHT - Flappy.GROUND_HEIGHT - Flappy.AVATAR_WIDTH + 4;
    if (Flappy.avatarY >= max) {
      Flappy.avatarY = max;
      Flappy.gameState = Flappy.GameStates.OVER;
      // Flappy.clearEventHandlersKillTickLoop();
    }

    document.getElementById('avatar').setAttribute('transform',
      'translate(' + Flappy.AVATAR_WIDTH + ', 0) ' +
      'rotate(90, ' + Flappy.avatarX + ', ' + Flappy.avatarY + ')');
    if (infoText) {
      document.getElementById('gameover').setAttribute('visibility', 'visibile');
    }
  }

  Flappy.displayAvatar(Flappy.avatarX, Flappy.avatarY);
  Flappy.displayObstacles();
  if (Flappy.gameState <= Flappy.GameStates.ACTIVE) {
    Flappy.displayGround(Flappy.tickCount);
    Flappy.displayGoal();
  }

  if (checkFinished()) {
    Flappy.onPuzzleComplete();
  }
};

Flappy.onMouseDown = function (e) {
  if (Flappy.intervalId) {
    Flappy.clickPending = true;
    if (Flappy.gameState === Flappy.GameStates.WAITING) {
      Flappy.gameState = Flappy.GameStates.ACTIVE;
    }
    document.getElementById('instructions').setAttribute('visibility', 'hidden');
    document.getElementById('getready').setAttribute('visibility', 'hidden');
  } else if (Flappy.gameState === Flappy.GameStates.WAITING) {
    BlocklyApps.runButtonClick();
  }
};
/**
 * Initialize Blockly and the Flappy app.  Called on page load.
 */
Flappy.init = function(config) {
  Flappy.clearEventHandlersKillTickLoop();
  skin = config.skin;
  level = config.level;
  onSharePage = config.share;
  loadLevel();

  config.html = page({
    assetUrl: BlocklyApps.assetUrl,
    data: {
      localeDirection: BlocklyApps.localeDirection(),
      visualization: require('./visualization.html')(),
      controls: require('./controls.html')({assetUrl: BlocklyApps.assetUrl}),
      blockUsed: undefined,
      idealBlockNumber: undefined,
      blockCounterClass: 'block-counter-default'
    }
  });

  config.loadAudio = function() {
    Blockly.loadAudio_(skin.winSound, 'win');
    Blockly.loadAudio_(skin.startSound, 'start');
    Blockly.loadAudio_(skin.failureSound, 'failure');
    Blockly.loadAudio_(skin.obstacleSound, 'obstacle');

    Blockly.loadAudio_(skin.dieSound, 'sfx_die');
    Blockly.loadAudio_(skin.hitSound, 'sfx_hit');
    Blockly.loadAudio_(skin.pointSound, 'sfx_point');
    Blockly.loadAudio_(skin.swooshingSound, 'sfx_swooshing');
    Blockly.loadAudio_(skin.wingSound, 'sfx_wing');
    Blockly.loadAudio_(skin.winGoalSound, 'winGoal');
    Blockly.loadAudio_(skin.jetSound, 'jet');
    Blockly.loadAudio_(skin.jingleSound, 'jingle');
    Blockly.loadAudio_(skin.crashSound, 'crash');
    Blockly.loadAudio_(skin.laserSound, 'laser');
    Blockly.loadAudio_(skin.splashSound, 'splash');
    // Load wall sounds.
    Blockly.loadAudio_(skin.wallSound, 'wall');
    if (skin.additionalSound) {
      Blockly.loadAudio_(skin.wall0Sound, 'wall0');
      Blockly.loadAudio_(skin.wall1Sound, 'wall1');
      Blockly.loadAudio_(skin.wall2Sound, 'wall2');
      Blockly.loadAudio_(skin.wall3Sound, 'wall3');
      Blockly.loadAudio_(skin.wall4Sound, 'wall4');
    }
  };

  config.afterInject = function() {
    /**
     * The richness of block colours, regardless of the hue.
     * MOOC blocks should be brighter (target audience is younger).
     * Must be in the range of 0 (inclusive) to 1 (exclusive).
     * Blockly's default is 0.45.
     */
    Blockly.HSV_SATURATION = 0.6;

    Blockly.SNAP_RADIUS *= Flappy.scale.snapRadius;

    drawMap();
  };

  config.getDisplayWidth = function() {
    var visualization = document.getElementById('visualization');
    return visualization.getBoundingClientRect().width;
  };

  config.trashcan = false;

  config.twitter = twitterOptions;

  // for flappy show make your own button if on share page
  config.makeYourOwn = config.share;

  BlocklyApps.init(config);

  if (!onSharePage) {
    var shareButton = document.getElementById('shareButton');
    dom.addClickTouchEvent(shareButton, Flappy.onPuzzleComplete);
  }
};

/**
 * Clear the event handlers and stop the onTick timer.
 */
Flappy.clearEventHandlersKillTickLoop = function() {
  Flappy.whenClick = null;
  Flappy.whenCollideGround = null;
  Flappy.whenCollideObstacle = null;
  Flappy.whenEnterObstacle = null;
  Flappy.whenRunButton = null;
  if (Flappy.intervalId) {
    window.clearInterval(Flappy.intervalId);
  }
  Flappy.intervalId = 0;
};

/**
 * Reset the app to the start position and kill any pending animation tasks.
 * @param {boolean} first True if an opening animation is to be played.
 */
BlocklyApps.reset = function(first) {
  var i;
  Flappy.clearEventHandlersKillTickLoop();

  Flappy.gameState = Flappy.GameStates.WAITING;

  // Kill all tasks.
  for (i = 0; i < Flappy.pidList.length; i++) {
    window.clearTimeout(Flappy.pidList[i]);
  }
  Flappy.pidList = [];

  // Reset the score.
  Flappy.playerScore = 0;

  Flappy.avatarVelocity = 0;

  // Reset obstacles
  Flappy.obstacles.forEach(function (obstacle, index) {
    obstacle.reset(Flappy.MAZE_WIDTH * 1.5 + index * Flappy.OBSTACLE_SPACING);
  });

  // reset configurable values
  Flappy.SPEED = 0;
  Flappy.FLAP_VELOCITY = -11;
  Flappy.setBackground('flappy');
  Flappy.setObstacle('flappy');
  Flappy.setPlayer('flappy');
  Flappy.setGround('flappy');
  Flappy.setGapHeight(api.GapHeight.NORMAL);

  // Move Avatar into position.
  Flappy.avatarX = 110;
  Flappy.avatarY = 150;

  if (level.goal && level.goal.startX) {
    Flappy.goalX = level.goal.startX;
    Flappy.goalY = level.goal.startY;
  }

  document.getElementById('avatar').setAttribute('transform', '');
  document.getElementById('score').setAttribute('visibility', 'hidden');
  document.getElementById('instructions').setAttribute('visibility', 'hidden');
  document.getElementById('clickrun').setAttribute('visibility', 'visible');
  document.getElementById('getready').setAttribute('visibility', 'hidden');
  document.getElementById('gameover').setAttribute('visibility', 'hidden');

  Flappy.displayAvatar(Flappy.avatarX, Flappy.avatarY);
  Flappy.displayObstacles();
  Flappy.displayGround(0);
  Flappy.displayGoal();

  var svg = document.getElementById('svgFlappy');
};

/**
 * Click the run button.  Start the program.
 */
// XXX This is the only method used by the templates!
BlocklyApps.runButtonClick = function() {
  // Only allow a single top block on some levels.
  if (level.singleTopBlock &&
      Blockly.mainWorkspace.getTopBlocks().length > 1) {
    window.alert(commonMsg.oneTopBlock());
    return;
  }
  var runButton = document.getElementById('runButton');
  var resetButton = document.getElementById('resetButton');
  // Ensure that Reset button is at least as wide as Run button.
  if (!resetButton.style.minWidth) {
    resetButton.style.minWidth = runButton.offsetWidth + 'px';
  }
  document.getElementById('clickrun').setAttribute('visibility', 'hidden');
  document.getElementById('instructions').setAttribute('visibility', 'visible');
  document.getElementById('getready').setAttribute('visibility', 'visible');

  runButton.style.display = 'none';
  resetButton.style.display = 'inline';
  Blockly.mainWorkspace.traceOn(true);
  // BlocklyApps.reset(false);
  BlocklyApps.attempts++;
  Flappy.execute();

  if (level.freePlay && !onSharePage) {
    var shareCell = document.getElementById('share-cell');
    shareCell.className = 'share-cell-enabled';
  }
  if (level.score) {
    document.getElementById('score').setAttribute('visibility', 'visible');
    Flappy.displayScore();
  }
};

/**
 * Outcomes of running the user program.
 */
var ResultType = {
  UNSET: 0,
  SUCCESS: 1,
  FAILURE: -1,
  TIMEOUT: 2,
  ERROR: -2
};

/**
 * App specific displayFeedback function that calls into
 * BlocklyApps.displayFeedback when appropriate
 */
var displayFeedback = function() {
  if (!Flappy.waitingForReport) {
    BlocklyApps.displayFeedback({
      app: 'flappy', //XXX
      skin: skin.id,
      feedbackType: Flappy.testResults,
      response: Flappy.response,
      level: level,
      showingSharing: level.freePlay,
      twitter: twitterOptions
    });
  }
};

/**
 * Function to be called when the service report call is complete
 * @param {object} JSON response (if available)
 */
Flappy.onReportComplete = function(response) {
  Flappy.response = response;
  Flappy.waitingForReport = false;
  // Disable the run button until onReportComplete is called.
  var runButton = document.getElementById('runButton');
  runButton.disabled = false;
  displayFeedback();
};

/**
 * Execute the user's code.  Heaven help us...
 */
Flappy.execute = function() {
  BlocklyApps.log = [];
  BlocklyApps.ticks = 100; //TODO: Set higher for some levels
  var code = Blockly.Generator.workspaceToCode('JavaScript', 'flappy_whenRun');
  Flappy.result = ResultType.UNSET;
  Flappy.testResults = BlocklyApps.TestResults.NO_TESTS_RUN;
  Flappy.waitingForReport = false;
  Flappy.response = null;

  // Check for empty top level blocks to warn user about bugs,
  // especially ones that lead to infinite loops.
  if (feedback.hasEmptyTopLevelBlocks()) {
    Flappy.testResults = BlocklyApps.TestResults.EMPTY_BLOCK_FAIL;
    displayFeedback();
    return;
  }

  if (level.editCode) {
    var codeTextbox = document.getElementById('codeTextbox');
    code = dom.getText(codeTextbox);
    // Insert aliases from level codeBlocks into code
    if (level.codeFunctions) {
      for (var i = 0; i < level.codeFunctions.length; i++) {
        var codeFunction = level.codeFunctions[i];
        if (codeFunction.alias) {
          code = codeFunction.func +
              " = function() { " + codeFunction.alias + " };" + code;
        }
      }
    }
  }

  var codeClick = Blockly.Generator.workspaceToCode(
                                    'JavaScript',
                                    'flappy_whenClick');
  var whenClickFunc = codegen.functionFromCode(
                                      codeClick, {
                                      BlocklyApps: BlocklyApps,
                                      Flappy: api } );

  var codeCollideGround = Blockly.Generator.workspaceToCode(
                                    'JavaScript',
                                    'flappy_whenCollideGround');
  var whenCollideGroundFunc = codegen.functionFromCode(
                                      codeCollideGround, {
                                      BlocklyApps: BlocklyApps,
                                      Flappy: api } );

  var codeEnterObstacle = Blockly.Generator.workspaceToCode(
                                    'JavaScript',
                                    'flappy_whenEnterObstacle');
  var whenEnterObstacleFunc = codegen.functionFromCode(
                                      codeEnterObstacle, {
                                      BlocklyApps: BlocklyApps,
                                      Flappy: api } );

  var codeCollideObstacle = Blockly.Generator.workspaceToCode(
                                    'JavaScript',
                                    'flappy_whenCollideObstacle');
  var whenCollideObstacleFunc = codegen.functionFromCode(
                                      codeCollideObstacle, {
                                      BlocklyApps: BlocklyApps,
                                      Flappy: api } );

  var codeWhenRunButton = Blockly.Generator.workspaceToCode(
                                    'JavaScript',
                                    'flappy_whenRunButtonClick');
  var whenRunButtonFunc = codegen.functionFromCode(
                                      codeWhenRunButton, {
                                      BlocklyApps: BlocklyApps,
                                      Flappy: api } );


  BlocklyApps.playAudio('start', {volume: 0.5});

  // BlocklyApps.reset(false);

  // Set event handlers and start the onTick timer
  Flappy.whenClick = whenClickFunc;
  Flappy.whenCollideGround = whenCollideGroundFunc;
  Flappy.whenEnterObstacle = whenEnterObstacleFunc;
  Flappy.whenCollideObstacle = whenCollideObstacleFunc;
  Flappy.whenRunButton = whenRunButtonFunc;

  Flappy.tickCount = 0;
  Flappy.firstActiveTick = -1;
  if (Flappy.intervalId) {
    window.clearInterval(Flappy.intervalId);
  }
  Flappy.intervalId = window.setInterval(Flappy.onTick, Flappy.scale.stepSpeed);
};

Flappy.onPuzzleComplete = function() {
  if (level.freePlay) {
    Flappy.result = ResultType.SUCCESS;
  }

  // Stop everything on screen
  Flappy.clearEventHandlersKillTickLoop();

  // If we know they succeeded, mark levelComplete true
  // Note that we have not yet animated the succesful run
  BlocklyApps.levelComplete = (Flappy.result == ResultType.SUCCESS);

  // If the current level is a free play, always return the free play
  // result type
  if (level.freePlay) {
    Flappy.testResults = BlocklyApps.TestResults.FREE_PLAY;
  } else {
    Flappy.testResults = BlocklyApps.getTestResults();
  }

  // Special case for Flappy level 1 where you have the right blocks, but you
  // don't flap to the goal.  Note: this currently depends on us getting
  // TOO_FEW_BLOCKS_FAIL, when really we should probably be getting
  // LEVEL_INCOMPLETE_FAIL here. (see pivotal item 66362504)
  if (level.id === "1" &&
    Flappy.testResults === BlocklyApps.TestResults.TOO_FEW_BLOCKS_FAIL) {
    Flappy.testResults = BlocklyApps.TestResults.FLAPPY_SPECIFIC_FAIL;
  }


  if (Flappy.testResults >= BlocklyApps.TestResults.FREE_PLAY) {
    BlocklyApps.playAudio('win', {volume : 0.5});
  } else {
    BlocklyApps.playAudio('failure', {volume : 0.5});
  }

  if (level.editCode) {
    Flappy.testResults = BlocklyApps.levelComplete ?
      BlocklyApps.TestResults.ALL_PASS :
      BlocklyApps.TestResults.TOO_FEW_BLOCKS_FAIL;
  }

  if (level.failForOther1Star && !BlocklyApps.levelComplete) {
    Flappy.testResults = BlocklyApps.TestResults.OTHER_1_STAR_FAIL;
  }

  var xml = Blockly.Xml.workspaceToDom(Blockly.mainWorkspace);
  var textBlocks = Blockly.Xml.domToText(xml);

  Flappy.waitingForReport = true;

  // Report result to server.
  BlocklyApps.report({
                     app: 'flappy',
                     level: level.id,
                     result: Flappy.result === ResultType.SUCCESS,
                     testResult: Flappy.testResults,
                     program: encodeURIComponent(textBlocks),
                     onComplete: Flappy.onReportComplete
                     });
};

/**
 * Display Avatar at the specified location
 * @param {number} x Horizontal Pixel location.
 * @param {number} y Vertical Pixel location.
 */
Flappy.displayAvatar = function(x, y) {
  var avatarIcon = document.getElementById('avatar');
  avatarIcon.setAttribute('x', x);
  avatarIcon.setAttribute('y', y);
};

/**
 * display moving goal
 */
Flappy.displayGoal = function() {
  if (!Flappy.goalX) {
    return;
  }
  var goal = document.getElementById('goal');
  goal.setAttribute('x', Flappy.goalX);
  goal.setAttribute('y', Flappy.goalY);
};


/**
 * Display ground at given tickCount
 */
Flappy.displayGround = function(tickCount) {
  if (!level.ground) {
    return;
  }
  var offset = tickCount * Flappy.SPEED;
  offset = offset % Flappy.GROUND_WIDTH;
  for (var i = 0; i < Flappy.MAZE_WIDTH / Flappy.GROUND_WIDTH + 1; i++) {
    var ground = document.getElementById('ground' + i);
    ground.setAttribute('x', -offset + i * Flappy.GROUND_WIDTH);
    ground.setAttribute('y', Flappy.MAZE_HEIGHT - Flappy.GROUND_HEIGHT);
  }
};

/**
 * Display all obstacles
 */
Flappy.displayObstacles = function () {
  for (var i = 0; i < Flappy.obstacles.length; i++) {
    var obstacle = Flappy.obstacles[i];
    var topIcon = document.getElementById('obstacle_top' + i);
    topIcon.setAttribute('x', obstacle.x);
    topIcon.setAttribute('y', obstacle.gapStart - Flappy.OBSTACLE_HEIGHT);

    var bottomIcon = document.getElementById('obstacle_bottom' + i);
    bottomIcon.setAttribute('x', obstacle.x);
    bottomIcon.setAttribute('y', obstacle.gapStart + Flappy.GAP_SIZE);
  }
};

Flappy.displayScore = function() {
  var score = document.getElementById('score');
  score.textContent = Flappy.playerScore;
};

Flappy.flap = function (amount) {
  var defaultFlap = level.defaultFlap || "NORMAL";
  Flappy.avatarVelocity = amount || api.FlapHeight[defaultFlap];
};

Flappy.setGapHeight = function (value) {
  var minGapSize = Flappy.MAZE_HEIGHT - Flappy.MIN_OBSTACLE_HEIGHT -
    Flappy.OBSTACLE_HEIGHT;
  if (value < minGapSize) {
    console.log('overriding gap height with: ' + minGapSize);
    value = minGapSize;
  }
  Flappy.GAP_SIZE = value;
};

var skinTheme = function (value) {
  if (value === 'flappy') {
    return skin;
  }
  return skin[value];
};

Flappy.setBackground = function (value) {
  var element = document.getElementById('background');
  element.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
    skinTheme(value).background);
};

Flappy.setPlayer = function (value) {
  var element = document.getElementById('avatar');
  element.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
    skinTheme(value).avatar);
};

Flappy.setObstacle = function (value) {
  var element;
  Flappy.obstacles.forEach(function (obstacle, index) {
    element = document.getElementById('obstacle_top' + index);
    element.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
      skinTheme(value).obstacle_top);

    element = document.getElementById('obstacle_bottom' + index);
    element.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
      skinTheme(value).obstacle_bottom);
  });
};

Flappy.setGround = function (value) {
  if (!level.ground) {
    return;
  }
  var element, i;
  for (i = 0; i < Flappy.MAZE_WIDTH / Flappy.GROUND_WIDTH + 1; i++) {
    element = document.getElementById('ground' + i);
    element.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
      skinTheme(value).ground);
  }
};

var checkTickLimit = function() {
  if (!level.tickLimit) {
    return false;
  }

  if ((Flappy.tickCount - Flappy.firstActiveTick) >= level.tickLimit &&
    (Flappy.gameState === Flappy.GameStates.ACTIVE ||
    Flappy.gameState === Flappy.GameStates.OVER)) {
    // We'll ignore tick limit if we're ending so that we fully finish ending
    // sequence
    return true;
  }

  return false;
};

var checkFinished = function () {
  // if we have a succcess condition and have accomplished it, we're done and successful
  if (level.goal && level.goal.successCondition && level.goal.successCondition()) {
    Flappy.result = ResultType.SUCCESS;
    return true;
  }

  // if we have a failure condition, and it's been reached, we're done and failed
  if (level.goal && level.goal.failureCondition && level.goal.failureCondition()) {
    Flappy.result = ResultType.FAILURE;
    return true;
  }

  return false;
};

},{"../../locale/en_us/common":30,"../../locale/en_us/flappy":31,"../base":2,"../codegen":4,"../dom":5,"../feedback.js":6,"../skins":16,"../templates/page.html":24,"./api":7,"./controls.html":9,"./tiles":14,"./visualization.html":15}],11:[function(require,module,exports){
/*jshint multistr: true */

// todo - i think our prepoluated code counts as LOCs

var Direction = require('./tiles').Direction;

var tb = function(blocks) {
  return '<xml id="toolbox" style="displastartY: none;">' + blocks + '</xml>';
};

var category = function (name, blocks) {
  return '<category id="' + name + '" name="' + name + '">' + blocks + '</category>';
};

var flapBlock = '<block type="flappy_flap"></block>';
var flapHeightBlock = '<block type="flappy_flap_height"></block>';
var endGameBlock = '<block type="flappy_endGame"></block>';
var playSoundBlock =  '<block type="flappy_playSound"></block>';
var incrementScoreBlock = '<block type="flappy_incrementPlayerScore"></block>';

var setSpeedBlock = '<block type="flappy_setSpeed"></block>';
var setBackgroundBlock = '<block type="flappy_setBackground"></block>';
var setGapHeightBlock = '<block type="flappy_setGapHeight"></block>';
var setPlayerBlock = '<block type="flappy_setPlayer"></block>';
var setObstacleBlock = '<block type="flappy_setObstacle"></block>';
var setGroundBlock = '<block type="flappy_setGround"></block>';

var COL_WIDTH = 210;
var COL1 = 20;
var COL2 = 20 + COL_WIDTH;

var ROW_HEIGHT = 120;
var ROW1 = 20;
var ROW2 = ROW1 + ROW_HEIGHT;
var ROW3 = ROW2 + ROW_HEIGHT;

var eventBlock = function (type, x, y, child) {
  return '<block type="' + type + '" deletable="false"' +
    ' x="' + x + '"' +
    ' y="' + y + '">' +
    (child ? '<next>' + child + '</next>' : '') +
    '</block>';
};

/*
 * Configuration for all levels.
 */

 /**
  * Explanation of options:
  * goal.startX/startY
  * - start location of flag image
  * goal.moving
  * - whether the goal stays in one spot or moves at level's speed
  * goal.successCondition
  * - condition(s), which if true at any point, indicate user has successfully
  *   completed the puzzle
  * goal.failureCondition
  * - condition(s), which if true at any point, indicates the puzzle is
      complete (indicating failure if success condition not met)
  */

module.exports = {
  '1': {
    'requiredBlocks': [
      [{'test': 'flap', 'type': 'flappy_flap'}]
    ],
    'obstacles': false,
    'ground': false,
    'score': false,
    'freePlay': false,
    'goal': {
      startX  : 100,
      startY: 0,
      successCondition: function () {
        return (Flappy.avatarY  <= 40);
      },
      failureCondition: function () {
        return Flappy.avatarY > Flappy.MAZE_HEIGHT;
      }
    },
    'scale': {
      'snapRadius': 2
    },
    'toolbox':
      tb(flapBlock + playSoundBlock),
    'startBlocks':
      eventBlock('flappy_whenClick', COL1, ROW1)
  },

  '2': {
    'requiredBlocks': [
      [{'test': 'endGame', 'type': 'flappy_endGame'}]
    ],
    'obstacles': false,
    'ground': true,
    'score': false,
    'freePlay': false,
    'goal': {
      startX: 100,
      startY: 400 - 48 - 56 / 2,
      successCondition: function () {
        // this only happens after avatar hits ground, and we spin him because of
        // game over
        return (Flappy.avatarY  === 322 && Flappy.avatarX === 110);
      },
      failureCondition: function () {
        var avatarBottom = Flappy.avatarY + Flappy.AVATAR_HEIGHT;
        var ground = Flappy.MAZE_HEIGHT - Flappy.GROUND_HEIGHT;
        return (avatarBottom >= ground && Flappy.gameState === Flappy.GameStates.ACTIVE);
      }
    },
    'scale': {
      'snapRadius': 2
    },
    'toolbox':
      tb(flapBlock + endGameBlock + playSoundBlock),
    'startBlocks':
      eventBlock('flappy_whenClick', COL1, ROW1, flapBlock) +
      eventBlock('flappy_whenCollideGround', COL2, ROW1)
  },

  '3': {
    'requiredBlocks': [
      [{'test': 'setSpeed', 'type': 'flappy_setSpeed'}]
    ],
    'obstacles': false,
    'ground': true,
    'score': false,
    'freePlay': false,
    'goal': {
      startX: 400 - 55,
      startY: 0,
      moving: true,
      successCondition: function () {
        var avatarCenter = {
          x: (Flappy.avatarX + Flappy.AVATAR_WIDTH) / 2,
          y: (Flappy.avatarY + Flappy.AVATAR_HEIGHT) / 2
        };
        var goalCenter = {
          x: (Flappy.goalX + Flappy.GOAL_SIZE) / 2,
          y: (Flappy.goalY + Flappy.GOAL_SIZE) / 2
        };

        var diff = {
          x: Math.abs(avatarCenter.x - goalCenter.x),
          y: Math.abs(avatarCenter.y - goalCenter.y)
        };

        return diff.x < 15 && diff.y < 15;
      },
      failureCondition: function () {
        return Flappy.activeTicks() >= 120 && Flappy.SPEED === 0;
      }
    },
    'scale': {
      'snapRadius': 2
    },
    'toolbox':
      tb(flapBlock + playSoundBlock + setSpeedBlock),
    'startBlocks':
      eventBlock('flappy_whenClick', COL1, ROW1, flapBlock) +
      eventBlock('flappy_whenRunButtonClick', COL1, ROW2)
  },

  '4': {
    'requiredBlocks': [
      [{'test': 'endGame', 'type': 'flappy_endGame'}]
    ],
    'obstacles': true,
    'ground': true,
    'score': false,
    'freePlay': false,
    'goal': {
      startX: 600 - (56 / 2),
      startY: 400 - 48 - 56 / 2,
      moving: true,
      successCondition: function () {
        return Flappy.obstacles[0].hitAvatar &&
          Flappy.gameState === Flappy.GameStates.OVER;
      },
      failureCondition: function () {
        // todo - would be nice if we could distinguish feedback for
        // flew through pipe vs. didnt hook up endGame block
        var obstacleEnd = Flappy.obstacles[0].x + Flappy.OBSTACLE_WIDTH;
        return obstacleEnd < Flappy.avatarX;
      }
    },
    'scale': {
      'snapRadius': 2
    },
    'toolbox':
      tb(flapBlock + endGameBlock + playSoundBlock + setSpeedBlock),
    'startBlocks':
      eventBlock('flappy_whenClick', 20, 20, flapBlock) +
      eventBlock('flappy_whenRunButtonClick', COL1, ROW2, setSpeedBlock) +
      eventBlock('flappy_whenCollideObstacle', COL2, ROW2)
  },

  '5': {
    'requiredBlocks': [
      [{'test': 'incrementPlayerScore', 'type': 'flappy_incrementPlayerScore'}]
    ],
    'defaultFlap': 'SMALL',
    'obstacles': true,
    'ground': true,
    'score': true,
    'freePlay': false,
    'goal': {
      // todo - kind of ugly that we end up loopin through all obstacles twice,
      // once to check for success and again to check for failure
      successCondition: function () {
        var insideObstacle = false;
        Flappy.obstacles.forEach(function (obstacle) {
          if (!obstacle.hitAvatar && obstacle.containsAvatar()) {
            insideObstacle = true;
          }
        });
        return insideObstacle && Flappy.playerScore === 1;
      },
      failureCondition: function () {
        var insideObstacle = false;
        Flappy.obstacles.forEach(function (obstacle) {
          if (!obstacle.hitAvatar && obstacle.containsAvatar()) {
            insideObstacle = true;
          }
        });
        return insideObstacle && Flappy.playerScore === 0;
      }
    },
    'scale': {
      'snapRadius': 2
    },
    'toolbox':
      tb(flapBlock + endGameBlock + incrementScoreBlock + playSoundBlock + setSpeedBlock),
    'startBlocks':
      eventBlock('flappy_whenClick', COL1, ROW1, flapBlock) +
      // eventBlock('flappy_whenCollideGround', COL1, ROW2, endGameBlock) +
      // eventBlock('flappy_whenCollideObstacle', COL2, ROW2, endGameBlock) +
      eventBlock('flappy_whenEnterObstacle', COL2, ROW1) +
      eventBlock('flappy_whenRunButtonClick', COL1, ROW2, setSpeedBlock)
  },

  '6': {
    'requiredBlocks': [
      [{'test': 'flap', 'type': 'flappy_flap_height'}]
    ],
    'obstacles': true,
    'ground': true,
    'score': true,
    'freePlay': false,
    'goal': {
      successCondition: function () {
        var insideObstacle = false;
        Flappy.obstacles.forEach(function (obstacle) {
          if (obstacle.containsAvatar()) {
            insideObstacle = true;
          }
        });
        return insideObstacle && Flappy.playerScore === 1;
      },
      failureCondition: function () {
        var insideObstacle = false;
        Flappy.obstacles.forEach(function (obstacle) {
          if (obstacle.containsAvatar()) {
            insideObstacle = true;
          }
        });
        return insideObstacle && Flappy.playerScore === 0;
      }
    },
    'scale': {
      'snapRadius': 2
    },
    'toolbox':
      tb(flapHeightBlock + endGameBlock + incrementScoreBlock + playSoundBlock + setSpeedBlock),
    'startBlocks':
      eventBlock('flappy_whenClick', COL1, ROW1) +
      // eventBlock('flappy_whenCollideGround', COL1, ROW2, endGameBlock) +
      // eventBlock('flappy_whenCollideObstacle', COL2, ROW2, endGameBlock) +
      eventBlock('flappy_whenEnterObstacle', COL2, ROW1, incrementScoreBlock) +
      eventBlock('flappy_whenRunButtonClick', COL1, ROW2, setSpeedBlock)
  },

  '7': {
    'requiredBlocks': [
      [{'test': 'setBackground', 'type': 'flappy_setBackground'}]
    ],
    'obstacles': true,
    'ground': true,
    'score': true,
    'freePlay': false,
    'goal': {
      successCondition: function () {
        return (Flappy.gameState === Flappy.GameStates.OVER);
      }
    },
    'scale': {
      'snapRadius': 2
    },
    'toolbox':
      tb(flapHeightBlock + endGameBlock + incrementScoreBlock + playSoundBlock +
        setSpeedBlock + setBackgroundBlock),
    'startBlocks':
      eventBlock('flappy_whenClick', COL1, ROW1, flapHeightBlock) +
      eventBlock('flappy_whenCollideGround', COL2, ROW1, endGameBlock) +
      eventBlock('flappy_whenCollideObstacle', COL2, ROW2, endGameBlock) +
      eventBlock('flappy_whenEnterObstacle', COL2, ROW3, incrementScoreBlock) +
      eventBlock('flappy_whenRunButtonClick', COL1, ROW2, setSpeedBlock)
  },

  '11': {
    'requiredBlocks': [
    ],
    'obstacles': true,
    'ground': true,
    'score': true,
    'freePlay': true,
    'scale': {
      'snapRadius': 2
    },
    'toolbox':
      tb(
        flapHeightBlock +
        playSoundBlock +
        incrementScoreBlock +
        endGameBlock +
        setSpeedBlock +
        setBackgroundBlock +
        setPlayerBlock +
        setObstacleBlock +
        setGroundBlock +
        setGapHeightBlock
      ),
    'startBlocks':
      eventBlock('flappy_whenClick', COL1, ROW1) +
      eventBlock('flappy_whenCollideGround', COL2, ROW1) +
      eventBlock('flappy_whenCollideObstacle', COL2, ROW2) +
      eventBlock('flappy_whenEnterObstacle', COL2, ROW3) +
      eventBlock('flappy_whenRunButtonClick', COL1, ROW2)
  }
};

},{"./tiles":14}],12:[function(require,module,exports){
var global=typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {};var appMain = require('../appMain');
window.Flappy = require('./flappy');
if (typeof global !== 'undefined') {
  global.Flappy = window.Flappy;
}
var blocks = require('./blocks');
var levels = require('./levels');
var skins = require('./skins');

window.flappyMain = function(options) {
  options.skinsModule = skins;
  options.blocksModule = blocks;
  appMain(window.Flappy, levels, options);
};

},{"../appMain":1,"./blocks":8,"./flappy":10,"./levels":11,"./skins":13}],13:[function(require,module,exports){
/**
 * Load Skin for Flappy.
 */
// tiles: A 250x200 set of 20 map images.
// goal: A 20x34 goal image.
// background: Number of 400x400 background images. Randomly select one if
// specified, otherwise, use background.png.
// graph: Colour of optional grid lines, or false.

var skinsBase = require('../skins');

var CONFIGS = {

  flappy: {
    transparentTileEnding: true,
    nonDisappearingPegmanHittingObstacle: true,
    additionalSound: true,
    background: 4
  }

};

exports.load = function(assetUrl, id) {
  var skin = skinsBase.load(assetUrl, id);
  var config = CONFIGS[skin.id];

  // todo: the way these are organized ends up being a little bit ugly as
  // lot of our assets are individual items not necessarily attached to a
  // specific theme

  skin.scifi = {
    background: skin.assetUrl('background_scifi.png'),
    avatar: skin.assetUrl('avatar_scifi.png'),
    obstacle_bottom: skin.assetUrl('obstacle_bottom_scifi.png'),
    obstacle_top: skin.assetUrl('obstacle_top_scifi.png'),
    ground: skin.assetUrl('ground_scifi.png')
  };

  skin.underwater = {
    background: skin.assetUrl('background_underwater.png'),
    avatar: skin.assetUrl('avatar_underwater.png'),
    obstacle_bottom: skin.assetUrl('obstacle_bottom_underwater.png'),
    obstacle_top: skin.assetUrl('obstacle_top_underwater.png'),
    ground: skin.assetUrl('ground_underwater.png')
  };

  skin.cave = {
    background: skin.assetUrl('background_cave.png'),
    avatar: skin.assetUrl('avatar_cave.png'),
    obstacle_bottom: skin.assetUrl('obstacle_bottom_cave.png'),
    obstacle_top: skin.assetUrl('obstacle_top_cave.png'),
    ground: skin.assetUrl('ground_cave.png')
  };

  skin.santa = {
    background: skin.assetUrl('background_santa.png'),
    avatar: skin.assetUrl('santa.png'),
    obstacle_bottom: skin.assetUrl('obstacle_bottom_santa.png'),
    obstacle_top: skin.assetUrl('obstacle_top_santa.png'),
    ground: skin.assetUrl('ground_santa.png')
  };

  skin.night = {
    background: skin.assetUrl('background_night.png')
  };

  skin.redbird = {
    avatar: skin.assetUrl('avatar_redbird.png')
  };

  skin.laser = {
    obstacle_bottom: skin.assetUrl('obstacle_bottom_laser.png'),
    obstacle_top: skin.assetUrl('obstacle_top_laser.png')
  };

  skin.lava = {
    ground: skin.assetUrl('ground_lava.png')
  };

  skin.shark = {
    avatar: skin.assetUrl('shark.png')
  };

  skin.easter = {
    avatar: skin.assetUrl('easterbunny.png')
  };

  skin.batman = {
    avatar: skin.assetUrl('batman.png')
  };

  skin.submarine = {
    avatar: skin.assetUrl('submarine.png')
  };

  skin.unicorn = {
    avatar: skin.assetUrl('unicorn.png')
  };

  skin.fairy = {
    avatar: skin.assetUrl('fairy.png')
  };

  skin.superman = {
    avatar: skin.assetUrl('superman.png')
  };

  skin.turkey = {
    avatar: skin.assetUrl('turkey.png')
  };

  // Images
  skin.ground = skin.assetUrl('ground.png');
  skin.obstacle_top = skin.assetUrl('obstacle_top.png');
  skin.obstacle_bottom = skin.assetUrl('obstacle_bottom.png');
  skin.instructions = skin.assetUrl('instructions.png');
  skin.clickrun = skin.assetUrl('clickrun.png');
  skin.getready = skin.assetUrl('getready.png');
  skin.gameover = skin.assetUrl('gameover.png');

  skin.tiles = skin.assetUrl('tiles.png');
  skin.goal = skin.assetUrl('goal.png');
  skin.goalSuccess = skin.assetUrl('goal_success.png');
  skin.goalAnimation = skin.assetUrl('goal.gif');
  skin.obstacle = skin.assetUrl('obstacle.png');
  skin.obstacleAnimation = skin.assetUrl('obstacle.gif');
  if (config.transparentTileEnding) {
    skin.transparentTileEnding = true;
  } else {
    skin.transparentTileEnding = false;
  }
  if (config.nonDisappearingPegmanHittingObstacle) {
    skin.nonDisappearingPegmanHittingObstacle = true;
  } else {
    skin.nonDisappearingPegmanHittingObstacle = false;
  }
  skin.obstacleScale = config.obstacleScale || 1.0;
  skin.largerObstacleAnimationTiles =
      skin.assetUrl(config.largerObstacleAnimationTiles);
  skin.hittingWallAnimation =
      skin.assetUrl(config.hittingWallAnimation);
  skin.approachingGoalAnimation =
      skin.assetUrl(config.approachingGoalAnimation);
  // Sounds
  skin.obstacleSound =
      [skin.assetUrl('obstacle.mp3'), skin.assetUrl('obstacle.ogg')];
  skin.wallSound = [skin.assetUrl('wall.mp3'), skin.assetUrl('wall.ogg')];
  skin.winGoalSound = [skin.assetUrl('win_goal.mp3'),
                       skin.assetUrl('win_goal.ogg')];
  skin.wall0Sound = [skin.assetUrl('wall0.mp3'), skin.assetUrl('wall0.ogg')];
  skin.wall1Sound = [skin.assetUrl('wall1.mp3'), skin.assetUrl('wall1.ogg')];
  skin.wall2Sound = [skin.assetUrl('wall2.mp3'), skin.assetUrl('wall2.ogg')];
  skin.wall3Sound = [skin.assetUrl('wall3.mp3'), skin.assetUrl('wall3.ogg')];
  skin.wall4Sound = [skin.assetUrl('wall4.mp3'), skin.assetUrl('wall4.ogg')];

  skin.dieSound = [skin.assetUrl('sfx_die.mp3'), skin.assetUrl('sfx_die.ogg')];
  skin.hitSound = [skin.assetUrl('sfx_hit.mp3'), skin.assetUrl('sfx_hit.ogg')];
  skin.pointSound = [skin.assetUrl('sfx_point.mp3'), skin.assetUrl('sfx_point.ogg')];
  skin.swooshingSound = [skin.assetUrl('sfx_swooshing.mp3'), skin.assetUrl('sfx_swooshing.ogg')];
  skin.wingSound = [skin.assetUrl('sfx_wing.mp3'), skin.assetUrl('sfx_wing.ogg')];

  skin.jetSound = [skin.assetUrl('jet.mp3'), skin.assetUrl('jet.ogg')];
  skin.crashSound = [skin.assetUrl('crash.mp3'), skin.assetUrl('crash.ogg')];
  skin.jingleSound = [skin.assetUrl('jingle.mp3'), skin.assetUrl('jingle.ogg')];
  skin.laserSound = [skin.assetUrl('laser.mp3'), skin.assetUrl('laser.ogg')];
  skin.splashSound = [skin.assetUrl('splash.mp3'), skin.assetUrl('splash.ogg')];

  skin.additionalSound = config.additionalSound;
  // Settings
  skin.graph = config.graph;
  skin.background = 'img/bsmbackg.png';
  skin.pegmanHeight = config.pegmanHeight || 48;
  skin.pegmanWidth = config.pegmanWidth || 60;
  skin.pegmanYOffset = config.pegmanYOffset || 0;
  return skin;
};

},{"../skins":16}],14:[function(require,module,exports){
'use strict';

/**
 * Constants for cardinal directions.  Subsequent code assumes these are
 * in the range 0..3 and that opposites have an absolute difference of 2.
 * @enum {number}
 */
exports.Direction = {
  NORTH: 0,
  EAST: 1,
  SOUTH: 2,
  WEST: 3
};

exports.PADDLE_BALL_COLLIDE_DISTANCE = 0.7;

/**
 * The types of squares in the maze, which is represented
 * as a 2D array of SquareType values.
 * @enum {number}
 */
exports.SquareType = {
  WALL: 0,
  OPEN: 1,
  BALLFINISH: 2,
  PADDLEFINISH: 3,
  OBSTACLE: 4,
  GOAL: 5,
  BALLSTART: 6,
  PADDLESTART: 7
};

},{}],15:[function(require,module,exports){
module.exports= (function() {
  var t = function anonymous(locals, filters, escape, rethrow) {
escape = escape || function (html){
  return String(html)
    .replace(/&(?!#?[a-zA-Z0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
};
var buf = [];
with (locals || {}) { (function(){ 
 buf.push('<svg xmlns="http://www.w3.org/2000/svg" version="1.1" id="svgFlappy">\n</svg>\n<div id="capacityBubble">\n  <div id="capacity"></div>\n</div>\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"ejs":32}],16:[function(require,module,exports){
// avatar: A 1029x51 set of 21 avatar images.

exports.load = function(assetUrl, id) {
  var skinUrl = function(path) {
    if (path !== undefined) {
      return assetUrl('media/skins/' + id + '/' + path);
    } else {
      return null;
    }
  };
  var skin = {
    id: id,
    assetUrl: skinUrl,
    // Images
    avatar: './img/tuncimarci2.png',//skinUrl('avatar.png'),
    tiles: skinUrl('tiles.png'),
    goal: skinUrl('goal.png'),
    obstacle: skinUrl('obstacle.png'),
    smallStaticAvatar: skinUrl('small_static_avatar.png'),
    staticAvatar: skinUrl('static_avatar.png'),
    winAvatar: skinUrl('win_avatar.png'),
    failureAvatar: skinUrl('failure_avatar.png'),
    // Sounds
    startSound: [skinUrl('start.mp3'), skinUrl('start.ogg')],
    winSound: [skinUrl('win.mp3'), skinUrl('win.ogg')],
    failureSound: [skinUrl('failure.mp3'), skinUrl('failure.ogg')]
  };
  return skin;
};

},{}],17:[function(require,module,exports){
/**
 * Blockly Apps: SVG Slider
 *
 * Copyright 2012 Google Inc.
 * http://blockly.googlecode.com/
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview A slider control in SVG.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

/**
 * Object representing a horizontal slider widget.
 * @param {number} x The horizontal offset of the slider.
 * @param {number} y The vertical offset of the slider.
 * @param {number} width The total width of the slider.
 * @param {!Element} svgParent The SVG element to append the slider to.
 * @param {Function} opt_changeFunc Optional callback function that will be
 *     called when the slider is moved.  The current value is passed.
 * @constructor
 */
var Slider = function(x, y, width, svgParent, opt_changeFunc) {
  this.KNOB_Y_ = y - 12;
  this.KNOB_MIN_X_ = x + 8;
  this.KNOB_MAX_X_ = x + width - 8;
  this.value_ = 0.5;
  this.changeFunc_ = opt_changeFunc;

  // Draw the slider.
  /*
  <line class="sliderTrack" x1="10" y1="35" x2="140" y2="35" />
  <path id="knob"
      transform="translate(67, 23)"
      d="m 8,0 l -8,8 v 12 h 16 v -12 z" />
  */
  var track = document.createElementNS(Slider.SVG_NS_, 'line');
  track.setAttribute('class', 'sliderTrack');
  track.setAttribute('x1', x);
  track.setAttribute('y1', y);
  track.setAttribute('x2', x + width);
  track.setAttribute('y2', y);
  svgParent.appendChild(track);
  this.track_ = track;
  var knob = document.createElementNS(Slider.SVG_NS_, 'path');
  knob.setAttribute('class', 'sliderKnob');
  knob.setAttribute('d', 'm 0,0 l -8,8 v 12 h 16 v -12 z');
  svgParent.appendChild(knob);
  this.knob_ = knob;
  this.setValue(0.5);

  // Find the root SVG object.
  while (svgParent && svgParent.nodeName.toLowerCase() != 'svg') {
    svgParent = svgParent.parentNode;
  }
  this.SVG_ = svgParent;

  // Bind the events to this slider.
  var thisSlider = this;
  Slider.bindEvent_(this.knob_, 'mousedown', function(e) {
    return thisSlider.knobMouseDown_(e);
  });
  Slider.bindEvent_(this.SVG_, 'mouseup', Slider.knobMouseUp_);
  Slider.bindEvent_(this.SVG_, 'mousemove', Slider.knobMouseMove_);
  Slider.bindEvent_(document, 'mouseover', Slider.mouseOver_);
};

Slider.SVG_NS_ = 'http://www.w3.org/2000/svg';

Slider.activeSlider_ = null;
Slider.startMouseX_ = 0;
Slider.startKnobX_ = 0;

/**
 * Start a drag when clicking down on the knob.
 * @param {!Event} e Mouse-down event.
 * @private
 */
Slider.prototype.knobMouseDown_ = function(e) {
  Slider.activeSlider_ = this;
  Slider.startMouseX_ = this.mouseToSvg_(e).x;
  Slider.startKnobX_ = 0;
  var transform = this.knob_.getAttribute('transform');
  if (transform) {
    var r = transform.match(/translate\(\s*([-\d.]+)/);
    if (r) {
      Slider.startKnobX_ = Number(r[1]);
    }
  }
  // Stop browser from attempting to drag the knob.
  e.preventDefault();
  return false;
};

/**
 * Stop a drag when clicking up anywhere.
 * @param {Event} e Mouse-up event.
 * @private
 */
Slider.knobMouseUp_ = function(e) {
  Slider.activeSlider_ = null;
};

/**
 * Stop a drag when the mouse enters a node not part of the SVG.
 * @param {Event} e Mouse-up event.
 * @private
 */
Slider.mouseOver_ = function(e) {
  if (!Slider.activeSlider_) {
    return;
  }
  // Find the root SVG object.
  for (var node = e.target; node; node = node.parentNode) {
    if (node == Slider.activeSlider_.SVG_) {
      return;
    }
  }
  Slider.knobMouseUp_(e);
};

/**
 * Drag the knob to follow the mouse.
 * @param {!Event} e Mouse-move event.
 * @private
 */
Slider.knobMouseMove_ = function(e) {
  var thisSlider = Slider.activeSlider_;
  if (!thisSlider) {
    return;
  }
  var x = thisSlider.mouseToSvg_(e).x - Slider.startMouseX_ +
      Slider.startKnobX_;
  x = Math.min(Math.max(x, thisSlider.KNOB_MIN_X_), thisSlider.KNOB_MAX_X_);
  thisSlider.knob_.setAttribute('transform',
      'translate(' + x + ',' + thisSlider.KNOB_Y_ + ')');

  thisSlider.value_ = (x - thisSlider.KNOB_MIN_X_) /
      (thisSlider.KNOB_MAX_X_ - thisSlider.KNOB_MIN_X_);
  if (thisSlider.changeFunc_) {
    thisSlider.changeFunc_(thisSlider.value_);
  }
};

/**
 * Returns the slider's value (0.0 - 1.0).
 * @return {number} Current value.
 */
Slider.prototype.getValue = function() {
  return this.value_;
};

/**
 * Sets the slider's value (0.0 - 1.0).
 * @param {number} value New value.
 */
Slider.prototype.setValue = function(value) {
  this.value_ = Math.min(Math.max(value, 0), 1);
  var x = this.KNOB_MIN_X_ +
      (this.KNOB_MAX_X_ - this.KNOB_MIN_X_) * this.value_;
  this.knob_.setAttribute('transform',
      'translate(' + x + ',' + this.KNOB_Y_ + ')');
};

/**
 * Convert the mouse coordinates into SVG coordinates.
 * @param {!Object} e Object with x and y mouse coordinates.
 * @return {!Object} Object with x and y properties in SVG coordinates.
 * @private
 */
Slider.prototype.mouseToSvg_ = function(e) {
  var svgPoint = this.SVG_.createSVGPoint();
  svgPoint.x = e.clientX;
  svgPoint.y = e.clientY;
  var matrix = this.SVG_.getScreenCTM().inverse();
  return svgPoint.matrixTransform(matrix);
};

/**
 * Bind an event to a function call.
 * @param {!Element} element Element upon which to listen.
 * @param {string} name Event name to listen to (e.g. 'mousedown').
 * @param {!Function} func Function to call when event is triggered.
 * @private
 */
Slider.bindEvent_ = function(element, name, func) {
  element.addEventListener(name, func, false);
};

module.exports = Slider;

},{}],18:[function(require,module,exports){
module.exports= (function() {
  var t = function anonymous(locals, filters, escape, rethrow) {
escape = escape || function (html){
  return String(html)
    .replace(/&(?!#?[a-zA-Z0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
};
var buf = [];
with (locals || {}) { (function(){ 
 buf.push('Instructions: <textarea type="text" name="instructions"></textarea>\nLevel Name: <textarea type="text" name="level_name"></textarea>\n<button id="create-level-button" class="launch">\n  Create Level\n</button>\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"ejs":32}],19:[function(require,module,exports){
module.exports= (function() {
  var t = function anonymous(locals, filters, escape, rethrow) {
escape = escape || function (html){
  return String(html)
    .replace(/&(?!#?[a-zA-Z0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
};
var buf = [];
with (locals || {}) { (function(){ 
 buf.push('');1; var msg = require('../../locale/en_us/common'); ; buf.push('\n\n');3; if (data.ok) {; buf.push('  <div class="farSide" style="padding: 1ex 3ex 0">\n    <button id="ok-button" class="secondary">\n      ', escape((5,  msg.dialogOK() )), '\n    </button>\n  </div>\n');8; };; buf.push('\n');9; if (data.previousLevel) {; buf.push('  <button id="back-button" class="launch">\n    ', escape((10,  msg.backToPreviousLevel() )), '\n  </button>\n');12; };; buf.push('\n');13; if (data.tryAgain) {; buf.push('  <button id="again-button" class="launch">\n    ', escape((14,  msg.tryAgain() )), '\n  </button>\n');16; };; buf.push('\n');17; if (data.nextLevel) {; buf.push('  <button id="continue-button" class="launch">\n    ', escape((18,  msg.continue() )), '\n  </button>\n');20; };; buf.push('\n');21; if (data.facebookUrl) {; buf.push('  <a href=', escape((21,  data.facebookUrl )), ' target="_blank">\n    <img src=', escape((22,  BlocklyApps.assetUrl("media/facebook_purple.png") )), '>\n  </a>\n');24; };; buf.push('\n');25; if (data.twitterUrl) {; buf.push('  <a href=', escape((25,  data.twitterUrl )), ' target="_blank">\n    <img src=', escape((26,  BlocklyApps.assetUrl("media/twitter_purple.png") )), ' >\n  </a>\n  <br>\n');29; };; buf.push('\n');30; if (data.sharingUrl) {; buf.push('  <input type="text" id="sharing-input" style="width:100%;" value=', escape((30,  data.sharingUrl )), ' >\n');31; };; buf.push(''); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"../../locale/en_us/common":30,"ejs":32}],20:[function(require,module,exports){
module.exports= (function() {
  var t = function anonymous(locals, filters, escape, rethrow) {
escape = escape || function (html){
  return String(html)
    .replace(/&(?!#?[a-zA-Z0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
};
var buf = [];
with (locals || {}) { (function(){ 
 buf.push('<div class="generated-code-container">\n  <p class="generatedCodeMessage">', escape((2,  message )), '</p>\n  <pre class="generatedCode">', escape((3,  code )), '</pre>\n</div>\n\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"ejs":32}],21:[function(require,module,exports){
module.exports= (function() {
  var t = function anonymous(locals, filters, escape, rethrow) {
escape = escape || function (html){
  return String(html)
    .replace(/&(?!#?[a-zA-Z0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
};
var buf = [];
with (locals || {}) { (function(){ 
 buf.push('');1; var msg = require('../../locale/en_us/common'); ; buf.push('\n\n<p class=\'dialog-title\'>', escape((3,  msg.puzzleTitle(locals) )), '</p>\n');4; if (locals.instructionImageUrl) {; buf.push('  <img class=\'instruction-image\' src=\'', escape((4,  locals.instructionImageUrl )), '\'>\n  <p class=\'instruction-with-image\'>', escape((5,  instructions )), '</p>\n');6; } else {; buf.push('  <p>', escape((6,  instructions )), '</p>\n');7; };; buf.push(''); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"../../locale/en_us/common":30,"ejs":32}],22:[function(require,module,exports){
module.exports= (function() {
  var t = function anonymous(locals, filters, escape, rethrow) {
escape = escape || function (html){
  return String(html)
    .replace(/&(?!#?[a-zA-Z0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
};
var buf = [];
with (locals || {}) { (function(){ 
 buf.push('');1; var msg = require('../../locale/en_us/common') ; buf.push('\n\n');3; var root = location.protocol + '//' + location.host.replace('learn\.', ''); 
; buf.push('\n\n<div id="learn">\n\n  <h1><a href="', escape((7,  root )), '">', escape((7,  msg.wantToLearn() )), '</a></h1>\n  <a href="', escape((8,  root )), '"><img id="learn-to-code" src="', escape((8,  BlocklyApps.assetUrl('media/promo.png') )), '"></a>\n  <a href="', escape((9,  root )), '">', escape((9,  msg.watchVideo() )), '</a>\n  <a href="', escape((10,  root )), '">', escape((10,  msg.tryHOC() )), '</a>\n  <a href="', escape((11,  location.protocol + '//' + location.host 
)), '">', escape((11,  msg.signup() )), '</a>\n\n</div>\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"../../locale/en_us/common":30,"ejs":32}],23:[function(require,module,exports){
module.exports= (function() {
  var t = function anonymous(locals, filters, escape, rethrow) {
escape = escape || function (html){
  return String(html)
    .replace(/&(?!#?[a-zA-Z0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
};
var buf = [];
with (locals || {}) { (function(){ 
 buf.push('');1; var msg = require('../../locale/en_us/common') ; buf.push('\n\n<div id="make-your-own">\n\n  <h1><a href="http://code.org/flappy">', escape((5,  msg.makeYourOwnFlappy() )), '</a></h1>\n  <a href="http://code.org/flappy"><img src="', escape((6,  BlocklyApps.assetUrl('media/flappy_promo.png') )), '"></a>\n\n</div>\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"../../locale/en_us/common":30,"ejs":32}],24:[function(require,module,exports){
module.exports= (function() {
  var t = function anonymous(locals, filters, escape, rethrow) {
escape = escape || function (html){
  return String(html)
    .replace(/&(?!#?[a-zA-Z0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
};
var buf = [];
with (locals || {}) { (function(){ 
 buf.push('');1; var msg = require('../../locale/en_us/common'); ; buf.push('\n\n<div id="rotateContainer" style="background-image: url(', escape((3,  assetUrl('media/mobile_tutorial_turnphone.png') )), ')">\n  <div id="rotateText">\n    <p>', escape((5,  msg.rotateText() )), '<br>', escape((5,  msg.orientationLock() )), '</p>\n  </div>\n</div>\n\n');9; var instructions = function() {; buf.push('  <div id="bubble">\n    <img id="prompt-icon">\n    <p id="prompt">\n    </p>\n  </div>\n');14; };; buf.push('\n');15; // A spot for the server to inject some HTML for help content.
var helpArea = function(html) {; buf.push('  ');16; if (html) {; buf.push('    <div id="helpArea">\n      ', (17,  html ), '\n    </div>\n  ');19; }; buf.push('');19; };; buf.push('\n');20; var codeArea = function() {; buf.push('  <div id="codeTextbox" contenteditable spellcheck=false>\n    // ', escape((21,  msg.typeCode() )), '\n    <br>\n    // ', escape((23,  msg.typeHint() )), '\n    <br>\n  </div>\n');26; }; ; buf.push('\n\n<div id="visualization">\n  ', (29,  data.visualization ), '\n</div>\n\n<div id="belowVisualization">\n\n  <table id="gameButtons">\n    <tr>\n      <td style="width:100%;">\n        <button id="runButton" class="launch">\n          <img src="', escape((38,  assetUrl('media/1x1.gif') )), '" class="run icon21">\n          ', escape((39,  msg.runProgram() )), '\n        </button>\n        <button id="resetButton" class="launch" style="display: none">\n          <img src="', escape((42,  assetUrl('media/1x1.gif') )), '" class="stop icon21">\n            ', escape((43,  msg.resetProgram() )), '\n        </button>\n      </td>\n      ');46; if (data.controls) { ; buf.push('\n        ', (47,  data.controls ), '\n      ');48; } ; buf.push('\n    </tr>\n  </table>\n\n  ');52; instructions() ; buf.push('\n  ');53; helpArea(data.helpHtml) ; buf.push('\n\n</div>\n\n<div id="blockly">\n  <div id="headers" dir="', escape((58,  data.localeDirection )), '">\n    <div id="toolbox-header" class="blockly-header"><span>', escape((59,  msg.toolboxHeader() )), '</span></div>\n    <div id="workspace-header" class="blockly-header">\n      <span id="blockCounter">', escape((61,  msg.workspaceHeader() )), '</span>\n      <div id="blockUsed" class=', escape((62,  data.blockCounterClass )), '>\n        ', escape((63,  data.blockUsed )), '\n      </div>\n      <span>&nbsp;/</span>\n      <span id="idealBlockNumber">', escape((66,  data.idealBlockNumber )), '</span>\n    </div>\n    <div id="show-code-header" class="blockly-header"><span>', escape((68,  msg.showCodeHeader() )), '</span></div>\n  </div>\n</div>\n\n<div class="clear"></div>\n\n');74; codeArea() ; buf.push('\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"../../locale/en_us/common":30,"ejs":32}],25:[function(require,module,exports){
module.exports= (function() {
  var t = function anonymous(locals, filters, escape, rethrow) {
escape = escape || function (html){
  return String(html)
    .replace(/&(?!#?[a-zA-Z0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
};
var buf = [];
with (locals || {}) { (function(){ 
 buf.push('<!DOCTYPE html>\n<html dir="', escape((2,  options.localeDirection )), '">\n<head>\n  <meta charset="utf-8">\n  <title>Blockly</title>\n  <script type="text/javascript" src="', escape((6,  assetUrl('js/' + options.locale + '/vendor.js') )), '"></script>\n  <script type="text/javascript" src="', escape((7,  assetUrl('js/' + options.locale + '/' + app + '.js') )), '"></script>\n  <script type="text/javascript">\n    ');9; // delay to onload to fix IE9. 
; buf.push('\n    window.onload = function() {\n      ', escape((11,  app )), 'Main(', (11, filters. json ( options )), ');\n    };\n  </script>\n</head>\n<body>\n  <div id="blockly"></div>\n  <style>\n    html, body {\n      background-color: #fff;\n      margin: 0;\n      padding:0;\n      overflow: hidden;\n      height: 100%;\n      font-family: \'Gotham A\', \'Gotham B\', sans-serif;\n    }\n    .blocklyText, .blocklyMenuText, .blocklyTreeLabel, .blocklyHtmlInput,\n        .blocklyIconMark, .blocklyTooltipText {\n      font-family: \'Gotham A\', \'Gotham B\', sans-serif;\n    }\n    #blockly>svg {\n      border: none;\n    }\n    #blockly {\n      position: absolute;\n      top: 0;\n      left: 0;\n      overflow: hidden;\n      height: 100%;\n      width: 100%;\n    }\n  </style>\n</body>\n</html>\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"ejs":32}],26:[function(require,module,exports){
module.exports= (function() {
  var t = function anonymous(locals, filters, escape, rethrow) {
escape = escape || function (html){
  return String(html)
    .replace(/&(?!#?[a-zA-Z0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
};
var buf = [];
with (locals || {}) { (function(){ 
 buf.push('');1; var msg = require('../../locale/en_us/common'); ; buf.push('\n\n<a id="show-code-button" href="#">', escape((3,  msg.showGeneratedCode() )), '</a>\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"../../locale/en_us/common":30,"ejs":32}],27:[function(require,module,exports){
module.exports= (function() {
  var t = function anonymous(locals, filters, escape, rethrow) {
escape = escape || function (html){
  return String(html)
    .replace(/&(?!#?[a-zA-Z0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
};
var buf = [];
with (locals || {}) { (function(){ 
 buf.push('<div class=\'trophy\'><img class=\'trophyimg\' src=\'', escape((1,  img_url )), '\'><br>', escape((1,  concept_name )), '</div>\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"ejs":32}],28:[function(require,module,exports){
exports.shallowCopy = function(source) {
  var result = {};
  for (var prop in source) {
    result[prop] = source[prop];
  }

  return result;
};

/**
 * Returns a new object with the properties from defaults overriden by any
 * properties in options. Leaves defaults and options unchanged.
 */
exports.extend = function(defaults, options) {
  var finalOptions = exports.shallowCopy(defaults);
  for (var prop in options) {
    finalOptions[prop] = options[prop];
  }

  return finalOptions;
};

exports.escapeHtml = function(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

},{}],29:[function(require,module,exports){
// Serializes an XML DOM node to a string.
exports.serialize = function(node) {
  var serializer = new XMLSerializer();
  return serializer.serializeToString(node);
};

// Parses a single root element string.
exports.parseElement = function(text) {
  var parser = new DOMParser();
  var dom = text.indexOf('<xml') === 0 ?
      parser.parseFromString(text, 'text/xml') :
      parser.parseFromString('<xml>' + text + '</xml>', 'text/xml');
  var errors = dom.getElementsByTagName("parsererror");
  var element = dom.firstChild;
  if (!element) {
    throw new Error('Nothing parsed');
  }
  if (errors.length > 0) {
    throw new Error(exports.serialize(errors[0]));
  }
  if (element !== dom.lastChild) {
    throw new Error('Parsed multiple elements');
  }
  return element;
};

},{}],30:[function(require,module,exports){
var MessageFormat = require("messageformat");MessageFormat.locale.en = function ( n ) {
  if ( n === 1 ) {
    return "one";
  }
  return "other";
};
exports.blocklyMessage = function(d){
var r = "";
r += "Blockly";
return r;
};

exports.catActions = function(d){
var r = "";
r += "Actions";
return r;
};

exports.catColour = function(d){
var r = "";
r += "Colour";
return r;
};

exports.catLogic = function(d){
var r = "";
r += "Logic";
return r;
};

exports.catLists = function(d){
var r = "";
r += "Lists";
return r;
};

exports.catLoops = function(d){
var r = "";
r += "Loops";
return r;
};

exports.catMath = function(d){
var r = "";
r += "Math";
return r;
};

exports.catProcedures = function(d){
var r = "";
r += "Functions";
return r;
};

exports.catText = function(d){
var r = "";
r += "Text";
return r;
};

exports.catVariables = function(d){
var r = "";
r += "Variables";
return r;
};

exports.codeTooltip = function(d){
var r = "";
r += "See generated JavaScript code.";
return r;
};

exports.continue = function(d){
var r = "";
r += "Continue";
return r;
};

exports.dialogCancel = function(d){
var r = "";
r += "Cancel";
return r;
};

exports.dialogOK = function(d){
var r = "";
r += "OK";
return r;
};

exports.emptyBlocksErrorMsg = function(d){
var r = "";
r += "The \"Repeat\" or \"If\" block needs to have other blocks inside it to work. Make sure the inner block fits properly inside the containing block.";
return r;
};

exports.finalStage = function(d){
var r = "";
r += "Congratulations! You have completed the final stage.";
return r;
};

exports.finalStageTrophies = function(d){
var r = "";
r += "Congratulations! You have completed the final stage and won ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "numTrophies";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "a trophy";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " trophies";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["en"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".";
return r;
};

exports.generatedCodeInfo = function(d){
var r = "";
r += "The blocks for your program can also be represented in JavaScript, the world's most widely adopted programming language:";
return r;
};

exports.hashError = function(d){
var r = "";
r += "Sorry, '%1' doesn't correspond with any saved program.";
return r;
};

exports.help = function(d){
var r = "";
r += "Help";
return r;
};

exports.hintTitle = function(d){
var r = "";
r += "Hint:";
return r;
};

exports.levelIncompleteError = function(d){
var r = "";
r += "You are using all of the necessary types of blocks but not in the right way.";
return r;
};

exports.listVariable = function(d){
var r = "";
r += "list";
return r;
};

exports.makeYourOwnFlappy = function(d){
var r = "";
r += "Make Your Own Flappy Game";
return r;
};

exports.missingBlocksErrorMsg = function(d){
var r = "";
r += "Try one or more of the blocks below to solve this puzzle.";
return r;
};

exports.nextLevel = function(d){
var r = "";
r += "Congratulations! You completed Puzzle ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["puzzleNumber"];
r += ".";
return r;
};

exports.nextLevelTrophies = function(d){
var r = "";
r += "Congratulations! You completed Puzzle ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["puzzleNumber"];
r += " and won ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "numTrophies";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "a trophy";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " trophies";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["en"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".";
return r;
};

exports.nextStage = function(d){
var r = "";
r += "Congratulations! You completed Stage ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["stageNumber"];
r += ".";
return r;
};

exports.nextStageTrophies = function(d){
var r = "";
r += "Congratulations! You completed Stage ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["stageNumber"];
r += " and won ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "numTrophies";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "a trophy";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " trophies";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["en"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".";
return r;
};

exports.numBlocksNeeded = function(d){
var r = "";
r += "Congratulations! You completed Puzzle ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["puzzleNumber"];
r += ". (However, you could have used only ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "numBlocks";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 block";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " blocks";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["en"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += ".)";
return r;
};

exports.numLinesOfCodeWritten = function(d){
var r = "";
r += "You just wrote ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "numLines";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 line";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " lines";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["en"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " of code!";
return r;
};

exports.puzzleTitle = function(d){
var r = "";
r += "Puzzle ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["puzzle_number"];
r += " of ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["stage_total"];
return r;
};

exports.reinfFeedbackMsgWithImage = function(d){
var r = "";
r += "Does your drawing look like this? You can press the \"Try again\" button to see your drawing.";
return r;
};

exports.reinfFeedbackMsg = function(d){
var r = "";
r += "Does this look like what you want? You can press the \"Try again\" button to see your drawing.";
return r;
};

exports.reinfFeedbackMsgFlappy = function(d){
var r = "";
r += "You can press the \"Try again\" button to go back to playing your game.";
return r;
};

exports.resetProgram = function(d){
var r = "";
r += "Reset";
return r;
};

exports.runProgram = function(d){
var r = "";
r += "Run Program";
return r;
};

exports.runTooltip = function(d){
var r = "";
r += "Run the program defined by the blocks in the workspace.";
return r;
};

exports.showCodeHeader = function(d){
var r = "";
r += "Show Code";
return r;
};

exports.showGeneratedCode = function(d){
var r = "";
r += "Show code";
return r;
};

exports.subtitle = function(d){
var r = "";
r += "a visual programming environment";
return r;
};

exports.textVariable = function(d){
var r = "";
r += "text";
return r;
};

exports.tooFewBlocksMsg = function(d){
var r = "";
r += "You are using all of the necessary types of blocks, but try using more  of these types of blocks to complete this puzzle.";
return r;
};

exports.tooManyBlocksMsg = function(d){
var r = "";
r += "This puzzle can be solved with <x id='START_SPAN'/><x id='END_SPAN'/> blocks.";
return r;
};

exports.tooMuchWork = function(d){
var r = "";
r += "You made me do a lot of work!  Could you try repeating fewer times?";
return r;
};

exports.flappySpecificFail = function(d){
var r = "";
r += "Your code looks good - it will flap with each click. But you need to click many times to flap to the target.";
return r;
};

exports.toolboxHeader = function(d){
var r = "";
r += "Blocks";
return r;
};

exports.openWorkspace = function(d){
var r = "";
r += "How It Works";
return r;
};

exports.totalNumLinesOfCodeWritten = function(d){
var r = "";
r += "All-time total: ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
var lastkey_1 = "numLines";
var k_1=d[lastkey_1];
var off_0 = 0;
var pf_0 = { 
"one" : function(d){
var r = "";
r += "1 line";
return r;
},
"other" : function(d){
var r = "";
r += "" + (function(){ var x = k_1 - off_0;
if( isNaN(x) ){
throw new Error("MessageFormat: `"+lastkey_1+"` isnt a number.");
}
return x;
})() + " lines";
return r;
}
};
if ( pf_0[ k_1 + "" ] ) {
r += pf_0[ k_1 + "" ]( d ); 
}
else {
r += (pf_0[ MessageFormat.locale["en"]( k_1 - off_0 ) ] || pf_0[ "other" ] )( d );
}
r += " of code.";
return r;
};

exports.tryAgain = function(d){
var r = "";
r += "Try again";
return r;
};

exports.backToPreviousLevel = function(d){
var r = "";
r += "Back to previous level";
return r;
};

exports.typeCode = function(d){
var r = "";
r += "Type your JavaScript code below these instructions.";
return r;
};

exports.typeFuncs = function(d){
var r = "";
r += "Available functions:%1";
return r;
};

exports.typeHint = function(d){
var r = "";
r += "Note that the parentheses and semicolons are required.";
return r;
};

exports.workspaceHeader = function(d){
var r = "";
r += "Assemble your blocks here: ";
return r;
};

exports.infinity = function(d){
var r = "";
r += "Infinity";
return r;
};

exports.rotateText = function(d){
var r = "";
r += "Rotate your device.";
return r;
};

exports.orientationLock = function(d){
var r = "";
r += "Turn off orientation lock in device settings.";
return r;
};

exports.shareDrawing = function(d){
var r = "";
r += "Share your drawing:";
return r;
};

exports.shareGame = function(d){
var r = "";
r += "Share your game:";
return r;
};

exports.wantToLearn = function(d){
var r = "";
r += "Want to learn to code?";
return r;
};

exports.watchVideo = function(d){
var r = "";
r += "Watch the Video";
return r;
};

exports.tryHOC = function(d){
var r = "";
r += "Try the Hour of Code";
return r;
};

exports.signup = function(d){
var r = "";
r += "Sign up for the intro course";
return r;
};


},{"messageformat":38}],31:[function(require,module,exports){
var MessageFormat = require("messageformat");MessageFormat.locale.en = function ( n ) {
  if ( n === 1 ) {
    return "one";
  }
  return "other";
};
exports.continue = function(d){
var r = "";
r += "Continue";
return r;
};

exports.doCode = function(d){
var r = "";
r += "do";
return r;
};

exports.elseCode = function(d){
var r = "";
r += "else";
return r;
};

exports.endGame = function(d){
var r = "";
r += "end game";
return r;
};

exports.endGameTooltip = function(d){
var r = "";
r += "Ends the game.";
return r;
};

exports.finalLevel = function(d){
var r = "";
r += "Congratulations! You have solved the final puzzle.";
return r;
};

exports.flap = function(d){
var r = "";
r += "flap";
return r;
};

exports.flapRandom = function(d){
var r = "";
r += "flap a random amount";
return r;
};

exports.flapVerySmall = function(d){
var r = "";
r += "flap a very small amount";
return r;
};

exports.flapSmall = function(d){
var r = "";
r += "flap a small amount";
return r;
};

exports.flapNormal = function(d){
var r = "";
r += "flap a normal amount";
return r;
};

exports.flapLarge = function(d){
var r = "";
r += "flap a large amount";
return r;
};

exports.flapVeryLarge = function(d){
var r = "";
r += "flap a very large amount";
return r;
};

exports.flapTooltip = function(d){
var r = "";
r += "Fly Flappy upwards.";
return r;
};

exports.incrementPlayerScore = function(d){
var r = "";
r += "score a point";
return r;
};

exports.incrementPlayerScoreTooltip = function(d){
var r = "";
r += "Add one to the current player score.";
return r;
};

exports.nextLevel = function(d){
var r = "";
r += "Congratulations! You have completed this puzzle.";
return r;
};

exports.no = function(d){
var r = "";
r += "No";
return r;
};

exports.numBlocksNeeded = function(d){
var r = "";
r += "This puzzle can be solved with %1 blocks.";
return r;
};

exports.oneTopBlock = function(d){
var r = "";
r += "For this puzzle, you need to stack together all of the blocks in the white workspace.";
return r;
};

exports.playSoundRandom = function(d){
var r = "";
r += "play random sound";
return r;
};

exports.playSoundBounce = function(d){
var r = "";
r += "play bounce sound";
return r;
};

exports.playSoundCrunch = function(d){
var r = "";
r += "play crunch sound";
return r;
};

exports.playSoundDie = function(d){
var r = "";
r += "play sad sound";
return r;
};

exports.playSoundHit = function(d){
var r = "";
r += "play smash sound";
return r;
};

exports.playSoundPoint = function(d){
var r = "";
r += "play point sound";
return r;
};

exports.playSoundSwoosh = function(d){
var r = "";
r += "play swoosh sound";
return r;
};

exports.playSoundWing = function(d){
var r = "";
r += "play wing sound";
return r;
};

exports.playSoundJet = function(d){
var r = "";
r += "play jet sound";
return r;
};

exports.playSoundCrash = function(d){
var r = "";
r += "play crash sound";
return r;
};

exports.playSoundJingle = function(d){
var r = "";
r += "play jingle sound";
return r;
};

exports.playSoundSplash = function(d){
var r = "";
r += "play splash sound";
return r;
};

exports.playSoundLaser = function(d){
var r = "";
r += "play laser sound";
return r;
};

exports.playSoundTooltip = function(d){
var r = "";
r += "Play the chosen sound.";
return r;
};

exports.scoreText = function(d){
var r = "";
r += "Score: ";
if(!d){
throw new Error("MessageFormat: No data passed to function.");
}
r += d["playerScore"];
return r;
};

exports.setBackgroundRandom = function(d){
var r = "";
r += "set scene Random";
return r;
};

exports.setBackgroundFlappy = function(d){
var r = "";
r += "set scene City (day)";
return r;
};

exports.setBackgroundNight = function(d){
var r = "";
r += "set scene City (night)";
return r;
};

exports.setBackgroundSciFi = function(d){
var r = "";
r += "set scene Sci-Fi";
return r;
};

exports.setBackgroundUnderwater = function(d){
var r = "";
r += "set scene Underwater";
return r;
};

exports.setBackgroundCave = function(d){
var r = "";
r += "set scene Cave";
return r;
};

exports.setBackgroundSanta = function(d){
var r = "";
r += "set scene Santa";
return r;
};

exports.setBackgroundTooltip = function(d){
var r = "";
r += "Sets the background image";
return r;
};

exports.setGapRandom = function(d){
var r = "";
r += "set a random gap";
return r;
};

exports.setGapVerySmall = function(d){
var r = "";
r += "set a very small gap";
return r;
};

exports.setGapSmall = function(d){
var r = "";
r += "set a small gap";
return r;
};

exports.setGapNormal = function(d){
var r = "";
r += "set a normal gap";
return r;
};

exports.setGapLarge = function(d){
var r = "";
r += "set a large gap";
return r;
};

exports.setGapVeryLarge = function(d){
var r = "";
r += "set a very large gap";
return r;
};

exports.setGapHeightTooltip = function(d){
var r = "";
r += "Sets the vertical gap in an obstacle";
return r;
};

exports.setGroundRandom = function(d){
var r = "";
r += "set ground Random";
return r;
};

exports.setGroundFlappy = function(d){
var r = "";
r += "set ground Ground";
return r;
};

exports.setGroundSciFi = function(d){
var r = "";
r += "set ground Sci-Fi";
return r;
};

exports.setGroundUnderwater = function(d){
var r = "";
r += "set ground Underwater";
return r;
};

exports.setGroundCave = function(d){
var r = "";
r += "set ground Cave";
return r;
};

exports.setGroundSanta = function(d){
var r = "";
r += "set ground Santa";
return r;
};

exports.setGroundLava = function(d){
var r = "";
r += "set ground Lava";
return r;
};

exports.setGroundTooltip = function(d){
var r = "";
r += "Sets the ground image";
return r;
};

exports.setObstacleRandom = function(d){
var r = "";
r += "set obstacle Random";
return r;
};

exports.setObstacleFlappy = function(d){
var r = "";
r += "set obstacle Pipe";
return r;
};

exports.setObstacleSciFi = function(d){
var r = "";
r += "set obstacle Sci-Fi";
return r;
};

exports.setObstacleUnderwater = function(d){
var r = "";
r += "set obstacle Plant";
return r;
};

exports.setObstacleCave = function(d){
var r = "";
r += "set obstacle Cave";
return r;
};

exports.setObstacleSanta = function(d){
var r = "";
r += "set obstacle Chimney";
return r;
};

exports.setObstacleLaser = function(d){
var r = "";
r += "set obstacle Laser";
return r;
};

exports.setObstacleTooltip = function(d){
var r = "";
r += "Sets the obstacle image";
return r;
};

exports.setPlayerRandom = function(d){
var r = "";
r += "set player Random";
return r;
};

exports.setPlayerFlappy = function(d){
var r = "";
r += "set player Yellow Bird";
return r;
};

exports.setPlayerRedBird = function(d){
var r = "";
r += "set player Red Bird";
return r;
};

exports.setPlayerSciFi = function(d){
var r = "";
r += "set player Spaceship";
return r;
};

exports.setPlayerUnderwater = function(d){
var r = "";
r += "set player Fish";
return r;
};

exports.setPlayerCave = function(d){
var r = "";
r += "set player Bat";
return r;
};

exports.setPlayerSanta = function(d){
var r = "";
r += "set player Santa";
return r;
};

exports.setPlayerShark = function(d){
var r = "";
r += "set player Shark";
return r;
};

exports.setPlayerEaster = function(d){
var r = "";
r += "set player Easter Bunny";
return r;
};

exports.setPlayerBatman = function(d){
var r = "";
r += "set player Batman";
return r;
};

exports.setPlayerSubmarine = function(d){
var r = "";
r += "set player Submarine";
return r;
};

exports.setPlayerUnicorn = function(d){
var r = "";
r += "set player Unicorn";
return r;
};

exports.setPlayerFairy = function(d){
var r = "";
r += "set player Fairy";
return r;
};

exports.setPlayerSuperman = function(d){
var r = "";
r += "set player Flappyman";
return r;
};

exports.setPlayerTurkey = function(d){
var r = "";
r += "set player Turkey";
return r;
};

exports.setPlayerTooltip = function(d){
var r = "";
r += "Sets the player image";
return r;
};

exports.setSpeed = function(d){
var r = "";
r += "set speed";
return r;
};

exports.setSpeedTooltip = function(d){
var r = "";
r += "Sets the levels speed";
return r;
};

exports.share = function(d){
var r = "";
r += "Share";
return r;
};

exports.shareFlappyTwitter = function(d){
var r = "";
r += "Check out the Flappy game I made. I wrote it myself with @codeorg";
return r;
};

exports.speedRandom = function(d){
var r = "";
r += "set speed random";
return r;
};

exports.speedVerySlow = function(d){
var r = "";
r += "set speed very slow";
return r;
};

exports.speedSlow = function(d){
var r = "";
r += "set speed slow";
return r;
};

exports.speedNormal = function(d){
var r = "";
r += "set speed normal";
return r;
};

exports.speedFast = function(d){
var r = "";
r += "set speed fast";
return r;
};

exports.speedVeryFast = function(d){
var r = "";
r += "set speed very fast";
return r;
};

exports.whenClick = function(d){
var r = "";
r += "when click";
return r;
};

exports.whenClickTooltip = function(d){
var r = "";
r += "Execute the actions below when a click event occurs.";
return r;
};

exports.whenCollideGround = function(d){
var r = "";
r += "when hit the ground";
return r;
};

exports.whenCollideGroundTooltip = function(d){
var r = "";
r += "Execute the actions below when Flappy hits the ground.";
return r;
};

exports.whenCollideObstacle = function(d){
var r = "";
r += "when hit an obstacle";
return r;
};

exports.whenCollideObstacleTooltip = function(d){
var r = "";
r += "Execute the actions below when Flappy hits an obstacle.";
return r;
};

exports.whenEnterObstacle = function(d){
var r = "";
r += "when pass obstacle";
return r;
};

exports.whenEnterObstacleTooltip = function(d){
var r = "";
r += "Execute the actions below when Flappy enters an obstacle.";
return r;
};

exports.whenRunButtonClick = function(d){
var r = "";
r += "when Run is clicked";
return r;
};

exports.whenRunButtonClickTooltip = function(d){
var r = "";
r += "Execute the actions below when the run button is pressed.";
return r;
};

exports.yes = function(d){
var r = "";
r += "Yes";
return r;
};


},{"messageformat":38}],32:[function(require,module,exports){

/*!
 * EJS
 * Copyright(c) 2012 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var utils = require('./utils')
  , path = require('path')
  , dirname = path.dirname
  , extname = path.extname
  , join = path.join
  , fs = require('fs')
  , read = fs.readFileSync;

/**
 * Filters.
 *
 * @type Object
 */

var filters = exports.filters = require('./filters');

/**
 * Intermediate js cache.
 *
 * @type Object
 */

var cache = {};

/**
 * Clear intermediate js cache.
 *
 * @api public
 */

exports.clearCache = function(){
  cache = {};
};

/**
 * Translate filtered code into function calls.
 *
 * @param {String} js
 * @return {String}
 * @api private
 */

function filtered(js) {
  return js.substr(1).split('|').reduce(function(js, filter){
    var parts = filter.split(':')
      , name = parts.shift()
      , args = parts.join(':') || '';
    if (args) args = ', ' + args;
    return 'filters.' + name + '(' + js + args + ')';
  });
};

/**
 * Re-throw the given `err` in context to the
 * `str` of ejs, `filename`, and `lineno`.
 *
 * @param {Error} err
 * @param {String} str
 * @param {String} filename
 * @param {String} lineno
 * @api private
 */

function rethrow(err, str, filename, lineno){
  var lines = str.split('\n')
    , start = Math.max(lineno - 3, 0)
    , end = Math.min(lines.length, lineno + 3);

  // Error context
  var context = lines.slice(start, end).map(function(line, i){
    var curr = i + start + 1;
    return (curr == lineno ? ' >> ' : '    ')
      + curr
      + '| '
      + line;
  }).join('\n');

  // Alter exception message
  err.path = filename;
  err.message = (filename || 'ejs') + ':'
    + lineno + '\n'
    + context + '\n\n'
    + err.message;
  
  throw err;
}

/**
 * Parse the given `str` of ejs, returning the function body.
 *
 * @param {String} str
 * @return {String}
 * @api public
 */

var parse = exports.parse = function(str, options){
  var options = options || {}
    , open = options.open || exports.open || '<%'
    , close = options.close || exports.close || '%>'
    , filename = options.filename
    , compileDebug = options.compileDebug !== false
    , buf = "";

  buf += 'var buf = [];';
  if (false !== options._with) buf += '\nwith (locals || {}) { (function(){ ';
  buf += '\n buf.push(\'';

  var lineno = 1;

  var consumeEOL = false;
  for (var i = 0, len = str.length; i < len; ++i) {
    var stri = str[i];
    if (str.slice(i, open.length + i) == open) {
      i += open.length
  
      var prefix, postfix, line = (compileDebug ? '__stack.lineno=' : '') + lineno;
      switch (str[i]) {
        case '=':
          prefix = "', escape((" + line + ', ';
          postfix = ")), '";
          ++i;
          break;
        case '-':
          prefix = "', (" + line + ', ';
          postfix = "), '";
          ++i;
          break;
        default:
          prefix = "');" + line + ';';
          postfix = "; buf.push('";
      }

      var end = str.indexOf(close, i)
        , js = str.substring(i, end)
        , start = i
        , include = null
        , n = 0;

      if ('-' == js[js.length-1]){
        js = js.substring(0, js.length - 2);
        consumeEOL = true;
      }

      if (0 == js.trim().indexOf('include')) {
        var name = js.trim().slice(7).trim();
        if (!filename) throw new Error('filename option is required for includes');
        var path = resolveInclude(name, filename);
        include = read(path, 'utf8');
        include = exports.parse(include, { filename: path, _with: false, open: open, close: close, compileDebug: compileDebug });
        buf += "' + (function(){" + include + "})() + '";
        js = '';
      }

      while (~(n = js.indexOf("\n", n))) n++, lineno++;
      if (js.substr(0, 1) == ':') js = filtered(js);
      if (js) {
        if (js.lastIndexOf('//') > js.lastIndexOf('\n')) js += '\n';
        buf += prefix;
        buf += js;
        buf += postfix;
      }
      i += end - start + close.length - 1;

    } else if (stri == "\\") {
      buf += "\\\\";
    } else if (stri == "'") {
      buf += "\\'";
    } else if (stri == "\r") {
      // ignore
    } else if (stri == "\n") {
      if (consumeEOL) {
        consumeEOL = false;
      } else {
        buf += "\\n";
        lineno++;
      }
    } else {
      buf += stri;
    }
  }

  if (false !== options._with) buf += "'); })();\n} \nreturn buf.join('');";
  else buf += "');\nreturn buf.join('');";
  return buf;
};

/**
 * Compile the given `str` of ejs into a `Function`.
 *
 * @param {String} str
 * @param {Object} options
 * @return {Function}
 * @api public
 */

var compile = exports.compile = function(str, options){
  options = options || {};
  var escape = options.escape || utils.escape;
  
  var input = JSON.stringify(str)
    , compileDebug = options.compileDebug !== false
    , client = options.client
    , filename = options.filename
        ? JSON.stringify(options.filename)
        : 'undefined';
  
  if (compileDebug) {
    // Adds the fancy stack trace meta info
    str = [
      'var __stack = { lineno: 1, input: ' + input + ', filename: ' + filename + ' };',
      rethrow.toString(),
      'try {',
      exports.parse(str, options),
      '} catch (err) {',
      '  rethrow(err, __stack.input, __stack.filename, __stack.lineno);',
      '}'
    ].join("\n");
  } else {
    str = exports.parse(str, options);
  }
  
  if (options.debug) console.log(str);
  if (client) str = 'escape = escape || ' + escape.toString() + ';\n' + str;

  try {
    var fn = new Function('locals, filters, escape, rethrow', str);
  } catch (err) {
    if ('SyntaxError' == err.name) {
      err.message += options.filename
        ? ' in ' + filename
        : ' while compiling ejs';
    }
    throw err;
  }

  if (client) return fn;

  return function(locals){
    return fn.call(this, locals, filters, escape, rethrow);
  }
};

/**
 * Render the given `str` of ejs.
 *
 * Options:
 *
 *   - `locals`          Local variables object
 *   - `cache`           Compiled functions are cached, requires `filename`
 *   - `filename`        Used by `cache` to key caches
 *   - `scope`           Function execution context
 *   - `debug`           Output generated function body
 *   - `open`            Open tag, defaulting to "<%"
 *   - `close`           Closing tag, defaulting to "%>"
 *
 * @param {String} str
 * @param {Object} options
 * @return {String}
 * @api public
 */

exports.render = function(str, options){
  var fn
    , options = options || {};

  if (options.cache) {
    if (options.filename) {
      fn = cache[options.filename] || (cache[options.filename] = compile(str, options));
    } else {
      throw new Error('"cache" option requires "filename".');
    }
  } else {
    fn = compile(str, options);
  }

  options.__proto__ = options.locals;
  return fn.call(options.scope, options);
};

/**
 * Render an EJS file at the given `path` and callback `fn(err, str)`.
 *
 * @param {String} path
 * @param {Object|Function} options or callback
 * @param {Function} fn
 * @api public
 */

exports.renderFile = function(path, options, fn){
  var key = path + ':string';

  if ('function' == typeof options) {
    fn = options, options = {};
  }

  options.filename = path;

  var str;
  try {
    str = options.cache
      ? cache[key] || (cache[key] = read(path, 'utf8'))
      : read(path, 'utf8');
  } catch (err) {
    fn(err);
    return;
  }
  fn(null, exports.render(str, options));
};

/**
 * Resolve include `name` relative to `filename`.
 *
 * @param {String} name
 * @param {String} filename
 * @return {String}
 * @api private
 */

function resolveInclude(name, filename) {
  var path = join(dirname(filename), name);
  var ext = extname(name);
  if (!ext) path += '.ejs';
  return path;
}

// express support

exports.__express = exports.renderFile;

/**
 * Expose to require().
 */

if (require.extensions) {
  require.extensions['.ejs'] = function (module, filename) {
    filename = filename || module.filename;
    var options = { filename: filename, client: true }
      , template = fs.readFileSync(filename).toString()
      , fn = compile(template, options);
    module._compile('module.exports = ' + fn.toString() + ';', filename);
  };
} else if (require.registerExtension) {
  require.registerExtension('.ejs', function(src) {
    return compile(src, {});
  });
}

},{"./filters":33,"./utils":34,"fs":35,"path":37}],33:[function(require,module,exports){
/*!
 * EJS - Filters
 * Copyright(c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * First element of the target `obj`.
 */

exports.first = function(obj) {
  return obj[0];
};

/**
 * Last element of the target `obj`.
 */

exports.last = function(obj) {
  return obj[obj.length - 1];
};

/**
 * Capitalize the first letter of the target `str`.
 */

exports.capitalize = function(str){
  str = String(str);
  return str[0].toUpperCase() + str.substr(1, str.length);
};

/**
 * Downcase the target `str`.
 */

exports.downcase = function(str){
  return String(str).toLowerCase();
};

/**
 * Uppercase the target `str`.
 */

exports.upcase = function(str){
  return String(str).toUpperCase();
};

/**
 * Sort the target `obj`.
 */

exports.sort = function(obj){
  return Object.create(obj).sort();
};

/**
 * Sort the target `obj` by the given `prop` ascending.
 */

exports.sort_by = function(obj, prop){
  return Object.create(obj).sort(function(a, b){
    a = a[prop], b = b[prop];
    if (a > b) return 1;
    if (a < b) return -1;
    return 0;
  });
};

/**
 * Size or length of the target `obj`.
 */

exports.size = exports.length = function(obj) {
  return obj.length;
};

/**
 * Add `a` and `b`.
 */

exports.plus = function(a, b){
  return Number(a) + Number(b);
};

/**
 * Subtract `b` from `a`.
 */

exports.minus = function(a, b){
  return Number(a) - Number(b);
};

/**
 * Multiply `a` by `b`.
 */

exports.times = function(a, b){
  return Number(a) * Number(b);
};

/**
 * Divide `a` by `b`.
 */

exports.divided_by = function(a, b){
  return Number(a) / Number(b);
};

/**
 * Join `obj` with the given `str`.
 */

exports.join = function(obj, str){
  return obj.join(str || ', ');
};

/**
 * Truncate `str` to `len`.
 */

exports.truncate = function(str, len, append){
  str = String(str);
  if (str.length > len) {
    str = str.slice(0, len);
    if (append) str += append;
  }
  return str;
};

/**
 * Truncate `str` to `n` words.
 */

exports.truncate_words = function(str, n){
  var str = String(str)
    , words = str.split(/ +/);
  return words.slice(0, n).join(' ');
};

/**
 * Replace `pattern` with `substitution` in `str`.
 */

exports.replace = function(str, pattern, substitution){
  return String(str).replace(pattern, substitution || '');
};

/**
 * Prepend `val` to `obj`.
 */

exports.prepend = function(obj, val){
  return Array.isArray(obj)
    ? [val].concat(obj)
    : val + obj;
};

/**
 * Append `val` to `obj`.
 */

exports.append = function(obj, val){
  return Array.isArray(obj)
    ? obj.concat(val)
    : obj + val;
};

/**
 * Map the given `prop`.
 */

exports.map = function(arr, prop){
  return arr.map(function(obj){
    return obj[prop];
  });
};

/**
 * Reverse the given `obj`.
 */

exports.reverse = function(obj){
  return Array.isArray(obj)
    ? obj.reverse()
    : String(obj).split('').reverse().join('');
};

/**
 * Get `prop` of the given `obj`.
 */

exports.get = function(obj, prop){
  return obj[prop];
};

/**
 * Packs the given `obj` into json string
 */
exports.json = function(obj){
  return JSON.stringify(obj);
};

},{}],34:[function(require,module,exports){

/*!
 * EJS
 * Copyright(c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Escape the given string of `html`.
 *
 * @param {String} html
 * @return {String}
 * @api private
 */

exports.escape = function(html){
  return String(html)
    .replace(/&(?!#?[a-zA-Z0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
};
 

},{}],35:[function(require,module,exports){

},{}],36:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],37:[function(require,module,exports){
var process=require("__browserify_process");// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

},{"__browserify_process":36}],38:[function(require,module,exports){
/**
 * messageformat.js
 *
 * ICU PluralFormat + SelectFormat for JavaScript
 *
 * @author Alex Sexton - @SlexAxton
 * @version 0.1.5
 * @license WTFPL
 * @contributor_license Dojo CLA
*/
(function ( root ) {

  // Create the contructor function
  function MessageFormat ( locale, pluralFunc ) {
    var fallbackLocale;

    if ( locale && pluralFunc ) {
      MessageFormat.locale[ locale ] = pluralFunc;
    }

    // Defaults
    fallbackLocale = locale = locale || "en";
    pluralFunc = pluralFunc || MessageFormat.locale[ fallbackLocale = MessageFormat.Utils.getFallbackLocale( locale ) ];

    if ( ! pluralFunc ) {
      throw new Error( "Plural Function not found for locale: " + locale );
    }

    // Own Properties
    this.pluralFunc = pluralFunc;
    this.locale = locale;
    this.fallbackLocale = fallbackLocale;
  }

  // Set up the locales object. Add in english by default
  MessageFormat.locale = {
    "en" : function ( n ) {
      if ( n === 1 ) {
        return "one";
      }
      return "other";
    }
  };

  // Build out our basic SafeString type
  // more or less stolen from Handlebars by @wycats
  MessageFormat.SafeString = function( string ) {
    this.string = string;
  };

  MessageFormat.SafeString.prototype.toString = function () {
    return this.string.toString();
  };

  MessageFormat.Utils = {
    numSub : function ( string, key, depth ) {
      // make sure that it's not an escaped octothorpe
      return string.replace( /^#|[^\\]#/g, function (m) {
        var prefix = m && m.length === 2 ? m.charAt(0) : '';
        return prefix + '" + (function(){ var x = ' +
        key+';\nif( isNaN(x) ){\nthrow new Error("MessageFormat: `"+lastkey_'+depth+'+"` isnt a number.");\n}\nreturn x;\n})() + "';
      });
    },
    escapeExpression : function (string) {
      var escape = {
            "\n": "\\n",
            "\"": '\\"'
          },
          badChars = /[\n"]/g,
          possible = /[\n"]/,
          escapeChar = function(chr) {
            return escape[chr] || "&amp;";
          };

      // Don't escape SafeStrings, since they're already safe
      if ( string instanceof MessageFormat.SafeString ) {
        return string.toString();
      }
      else if ( string === null || string === false ) {
        return "";
      }

      if ( ! possible.test( string ) ) {
        return string;
      }
      return string.replace( badChars, escapeChar );
    },
    getFallbackLocale: function( locale ) {
      var tagSeparator = locale.indexOf("-") >= 0 ? "-" : "_";

      // Lets just be friends, fallback through the language tags
      while ( ! MessageFormat.locale.hasOwnProperty( locale ) ) {
        locale = locale.substring(0, locale.lastIndexOf( tagSeparator ));
        if (locale.length === 0) {
          return null;
        }
      }

      return locale;
    }
  };

  // This is generated and pulled in for browsers.
  var mparser = (function(){
    /* Generated by PEG.js 0.6.2 (http://pegjs.majda.cz/). */

    var result = {
      /*
      * Parses the input with a generated parser. If the parsing is successfull,
      * returns a value explicitly or implicitly specified by the grammar from
      * which the parser was generated (see |PEG.buildParser|). If the parsing is
      * unsuccessful, throws |PEG.parser.SyntaxError| describing the error.
      */
      parse: function(input, startRule) {
        var parseFunctions = {
          "_": parse__,
          "char": parse_char,
          "chars": parse_chars,
          "digits": parse_digits,
          "elementFormat": parse_elementFormat,
          "hexDigit": parse_hexDigit,
          "id": parse_id,
          "messageFormatElement": parse_messageFormatElement,
          "messageFormatPattern": parse_messageFormatPattern,
          "messageFormatPatternRight": parse_messageFormatPatternRight,
          "offsetPattern": parse_offsetPattern,
          "pluralFormatPattern": parse_pluralFormatPattern,
          "pluralForms": parse_pluralForms,
          "pluralStyle": parse_pluralStyle,
          "selectFormatPattern": parse_selectFormatPattern,
          "selectStyle": parse_selectStyle,
          "start": parse_start,
          "string": parse_string,
          "stringKey": parse_stringKey,
          "whitespace": parse_whitespace
        };

        if (startRule !== undefined) {
          if (parseFunctions[startRule] === undefined) {
            throw new Error("Invalid rule name: " + quote(startRule) + ".");
          }
        } else {
          startRule = "start";
        }

        var pos = 0;
        var reportMatchFailures = true;
        var rightmostMatchFailuresPos = 0;
        var rightmostMatchFailuresExpected = [];
        var cache = {};

        function padLeft(input, padding, length) {
          var result = input;

          var padLength = length - input.length;
          for (var i = 0; i < padLength; i++) {
            result = padding + result;
          }

          return result;
        }

        function escape(ch) {
          var charCode = ch.charCodeAt(0);

          if (charCode <= 0xFF) {
            var escapeChar = 'x';
            var length = 2;
          } else {
            var escapeChar = 'u';
            var length = 4;
          }

          return '\\' + escapeChar + padLeft(charCode.toString(16).toUpperCase(), '0', length);
        }

        function quote(s) {
          /*
          * ECMA-262, 5th ed., 7.8.4: All characters may appear literally in a
          * string literal except for the closing quote character, backslash,
          * carriage return, line separator, paragraph separator, and line feed.
          * Any character may appear in the form of an escape sequence.
          */
          return '"' + s
          .replace(/\\/g, '\\\\')            // backslash
          .replace(/"/g, '\\"')              // closing quote character
          .replace(/\r/g, '\\r')             // carriage return
          .replace(/\n/g, '\\n')             // line feed
          .replace(/[\x80-\uFFFF]/g, escape) // non-ASCII characters
          + '"';
        }

        function matchFailed(failure) {
          if (pos < rightmostMatchFailuresPos) {
            return;
          }

          if (pos > rightmostMatchFailuresPos) {
            rightmostMatchFailuresPos = pos;
            rightmostMatchFailuresExpected = [];
          }

          rightmostMatchFailuresExpected.push(failure);
        }

        function parse_start() {
          var cacheKey = 'start@' + pos;
          var cachedResult = cache[cacheKey];
          if (cachedResult) {
            pos = cachedResult.nextPos;
            return cachedResult.result;
          }


          var savedPos0 = pos;
          var result1 = parse_messageFormatPattern();
          var result2 = result1 !== null
          ? (function(messageFormatPattern) { return { type: "program", program: messageFormatPattern }; })(result1)
          : null;
          if (result2 !== null) {
            var result0 = result2;
          } else {
            var result0 = null;
            pos = savedPos0;
          }



          cache[cacheKey] = {
            nextPos: pos,
            result:  result0
          };
          return result0;
        }

        function parse_messageFormatPattern() {
          var cacheKey = 'messageFormatPattern@' + pos;
          var cachedResult = cache[cacheKey];
          if (cachedResult) {
            pos = cachedResult.nextPos;
            return cachedResult.result;
          }


          var savedPos0 = pos;
          var savedPos1 = pos;
          var result3 = parse_string();
          if (result3 !== null) {
            var result4 = [];
            var result5 = parse_messageFormatPatternRight();
            while (result5 !== null) {
              result4.push(result5);
              var result5 = parse_messageFormatPatternRight();
            }
            if (result4 !== null) {
              var result1 = [result3, result4];
            } else {
              var result1 = null;
              pos = savedPos1;
            }
          } else {
            var result1 = null;
            pos = savedPos1;
          }
          var result2 = result1 !== null
          ? (function(s1, inner) {
            var st = [];
            if ( s1 && s1.val ) {
              st.push( s1 );
            }
            for( var i in inner ){
              if ( inner.hasOwnProperty( i ) ) {
                st.push( inner[ i ] );
              }
            }
            return { type: 'messageFormatPattern', statements: st };
          })(result1[0], result1[1])
          : null;
          if (result2 !== null) {
            var result0 = result2;
          } else {
            var result0 = null;
            pos = savedPos0;
          }



          cache[cacheKey] = {
            nextPos: pos,
            result:  result0
          };
          return result0;
        }

        function parse_messageFormatPatternRight() {
          var cacheKey = 'messageFormatPatternRight@' + pos;
          var cachedResult = cache[cacheKey];
          if (cachedResult) {
            pos = cachedResult.nextPos;
            return cachedResult.result;
          }


          var savedPos0 = pos;
          var savedPos1 = pos;
          if (input.substr(pos, 1) === "{") {
            var result3 = "{";
              pos += 1;
            } else {
              var result3 = null;
              if (reportMatchFailures) {
                matchFailed("\"{\"");
                }
              }
              if (result3 !== null) {
                var result4 = parse__();
                if (result4 !== null) {
                  var result5 = parse_messageFormatElement();
                  if (result5 !== null) {
                    var result6 = parse__();
                    if (result6 !== null) {
                      if (input.substr(pos, 1) === "}") {
                        var result7 = "}";
                        pos += 1;
                  } else {
                    var result7 = null;
                    if (reportMatchFailures) {
                      matchFailed("\"}\"");
                  }
                }
                if (result7 !== null) {
                  var result8 = parse_string();
                  if (result8 !== null) {
                    var result1 = [result3, result4, result5, result6, result7, result8];
                  } else {
                    var result1 = null;
                    pos = savedPos1;
                  }
                } else {
                  var result1 = null;
                  pos = savedPos1;
                }
              } else {
                var result1 = null;
                pos = savedPos1;
              }
            } else {
              var result1 = null;
              pos = savedPos1;
            }
          } else {
            var result1 = null;
            pos = savedPos1;
          }
          } else {
            var result1 = null;
            pos = savedPos1;
          }
          var result2 = result1 !== null
          ? (function(mfe, s1) {
            var res = [];
            if ( mfe ) {
              res.push(mfe);
            }
            if ( s1 && s1.val ) {
              res.push( s1 );
            }
            return { type: "messageFormatPatternRight", statements : res };
          })(result1[2], result1[5])
          : null;
          if (result2 !== null) {
            var result0 = result2;
          } else {
            var result0 = null;
            pos = savedPos0;
          }



          cache[cacheKey] = {
            nextPos: pos,
            result:  result0
          };
          return result0;
        }

        function parse_messageFormatElement() {
          var cacheKey = 'messageFormatElement@' + pos;
          var cachedResult = cache[cacheKey];
          if (cachedResult) {
            pos = cachedResult.nextPos;
            return cachedResult.result;
          }


          var savedPos0 = pos;
          var savedPos1 = pos;
          var result3 = parse_id();
          if (result3 !== null) {
            var savedPos2 = pos;
            if (input.substr(pos, 1) === ",") {
              var result6 = ",";
              pos += 1;
            } else {
              var result6 = null;
              if (reportMatchFailures) {
                matchFailed("\",\"");
              }
            }
            if (result6 !== null) {
              var result7 = parse_elementFormat();
              if (result7 !== null) {
                var result5 = [result6, result7];
              } else {
                var result5 = null;
                pos = savedPos2;
              }
            } else {
              var result5 = null;
              pos = savedPos2;
            }
            var result4 = result5 !== null ? result5 : '';
            if (result4 !== null) {
              var result1 = [result3, result4];
            } else {
              var result1 = null;
              pos = savedPos1;
            }
          } else {
            var result1 = null;
            pos = savedPos1;
          }
          var result2 = result1 !== null
          ? (function(argIdx, efmt) {
            var res = {
              type: "messageFormatElement",
              argumentIndex: argIdx
            };
            if ( efmt && efmt.length ) {
              res.elementFormat = efmt[1];
            }
            else {
              res.output = true;
            }
            return res;
          })(result1[0], result1[1])
          : null;
          if (result2 !== null) {
            var result0 = result2;
          } else {
            var result0 = null;
            pos = savedPos0;
          }



          cache[cacheKey] = {
            nextPos: pos,
            result:  result0
          };
          return result0;
        }

        function parse_elementFormat() {
          var cacheKey = 'elementFormat@' + pos;
          var cachedResult = cache[cacheKey];
          if (cachedResult) {
            pos = cachedResult.nextPos;
            return cachedResult.result;
          }


          var savedPos2 = pos;
          var savedPos3 = pos;
          var result14 = parse__();
          if (result14 !== null) {
            if (input.substr(pos, 6) === "plural") {
              var result15 = "plural";
              pos += 6;
            } else {
              var result15 = null;
              if (reportMatchFailures) {
                matchFailed("\"plural\"");
              }
            }
            if (result15 !== null) {
              var result16 = parse__();
              if (result16 !== null) {
                if (input.substr(pos, 1) === ",") {
                  var result17 = ",";
                  pos += 1;
                } else {
                  var result17 = null;
                  if (reportMatchFailures) {
                    matchFailed("\",\"");
                  }
                }
                if (result17 !== null) {
                  var result18 = parse__();
                  if (result18 !== null) {
                    var result19 = parse_pluralStyle();
                    if (result19 !== null) {
                      var result20 = parse__();
                      if (result20 !== null) {
                        var result12 = [result14, result15, result16, result17, result18, result19, result20];
                      } else {
                        var result12 = null;
                        pos = savedPos3;
                      }
                    } else {
                      var result12 = null;
                      pos = savedPos3;
                    }
                  } else {
                    var result12 = null;
                    pos = savedPos3;
                  }
                } else {
                  var result12 = null;
                  pos = savedPos3;
                }
              } else {
                var result12 = null;
                pos = savedPos3;
              }
            } else {
              var result12 = null;
              pos = savedPos3;
            }
          } else {
            var result12 = null;
            pos = savedPos3;
          }
          var result13 = result12 !== null
          ? (function(t, s) {
            return {
              type : "elementFormat",
              key  : t,
              val  : s.val
            };
          })(result12[1], result12[5])
          : null;
          if (result13 !== null) {
            var result11 = result13;
          } else {
            var result11 = null;
            pos = savedPos2;
          }
          if (result11 !== null) {
            var result0 = result11;
          } else {
            var savedPos0 = pos;
            var savedPos1 = pos;
            var result4 = parse__();
            if (result4 !== null) {
              if (input.substr(pos, 6) === "select") {
                var result5 = "select";
                pos += 6;
              } else {
                var result5 = null;
                if (reportMatchFailures) {
                  matchFailed("\"select\"");
                }
              }
              if (result5 !== null) {
                var result6 = parse__();
                if (result6 !== null) {
                  if (input.substr(pos, 1) === ",") {
                    var result7 = ",";
                    pos += 1;
                  } else {
                    var result7 = null;
                    if (reportMatchFailures) {
                      matchFailed("\",\"");
                    }
                  }
                  if (result7 !== null) {
                    var result8 = parse__();
                    if (result8 !== null) {
                      var result9 = parse_selectStyle();
                      if (result9 !== null) {
                        var result10 = parse__();
                        if (result10 !== null) {
                          var result2 = [result4, result5, result6, result7, result8, result9, result10];
                        } else {
                          var result2 = null;
                          pos = savedPos1;
                        }
                      } else {
                        var result2 = null;
                        pos = savedPos1;
                      }
                    } else {
                      var result2 = null;
                      pos = savedPos1;
                    }
                  } else {
                    var result2 = null;
                    pos = savedPos1;
                  }
                } else {
                  var result2 = null;
                  pos = savedPos1;
                }
              } else {
                var result2 = null;
                pos = savedPos1;
              }
            } else {
              var result2 = null;
              pos = savedPos1;
            }
            var result3 = result2 !== null
            ? (function(t, s) {
              return {
                type : "elementFormat",
                key  : t,
                val  : s.val
              };
            })(result2[1], result2[5])
            : null;
            if (result3 !== null) {
              var result1 = result3;
            } else {
              var result1 = null;
              pos = savedPos0;
            }
            if (result1 !== null) {
              var result0 = result1;
            } else {
              var result0 = null;;
            };
          }



          cache[cacheKey] = {
            nextPos: pos,
            result:  result0
          };
          return result0;
        }

        function parse_pluralStyle() {
          var cacheKey = 'pluralStyle@' + pos;
          var cachedResult = cache[cacheKey];
          if (cachedResult) {
            pos = cachedResult.nextPos;
            return cachedResult.result;
          }


          var savedPos0 = pos;
          var result1 = parse_pluralFormatPattern();
          var result2 = result1 !== null
          ? (function(pfp) {
            return { type: "pluralStyle", val: pfp };
          })(result1)
          : null;
          if (result2 !== null) {
            var result0 = result2;
          } else {
            var result0 = null;
            pos = savedPos0;
          }



          cache[cacheKey] = {
            nextPos: pos,
            result:  result0
          };
          return result0;
        }

        function parse_selectStyle() {
          var cacheKey = 'selectStyle@' + pos;
          var cachedResult = cache[cacheKey];
          if (cachedResult) {
            pos = cachedResult.nextPos;
            return cachedResult.result;
          }


          var savedPos0 = pos;
          var result1 = parse_selectFormatPattern();
          var result2 = result1 !== null
          ? (function(sfp) {
            return { type: "selectStyle", val: sfp };
          })(result1)
          : null;
          if (result2 !== null) {
            var result0 = result2;
          } else {
            var result0 = null;
            pos = savedPos0;
          }



          cache[cacheKey] = {
            nextPos: pos,
            result:  result0
          };
          return result0;
        }

        function parse_pluralFormatPattern() {
          var cacheKey = 'pluralFormatPattern@' + pos;
          var cachedResult = cache[cacheKey];
          if (cachedResult) {
            pos = cachedResult.nextPos;
            return cachedResult.result;
          }


          var savedPos0 = pos;
          var savedPos1 = pos;
          var result6 = parse_offsetPattern();
          var result3 = result6 !== null ? result6 : '';
          if (result3 !== null) {
            var result4 = [];
            var result5 = parse_pluralForms();
            while (result5 !== null) {
              result4.push(result5);
              var result5 = parse_pluralForms();
            }
            if (result4 !== null) {
              var result1 = [result3, result4];
            } else {
              var result1 = null;
              pos = savedPos1;
            }
          } else {
            var result1 = null;
            pos = savedPos1;
          }
          var result2 = result1 !== null
          ? (function(op, pf) {
            var res = {
              type: "pluralFormatPattern",
              pluralForms: pf
            };
            if ( op ) {
              res.offset = op;
            }
            else {
              res.offset = 0;
            }
            return res;
          })(result1[0], result1[1])
          : null;
          if (result2 !== null) {
            var result0 = result2;
          } else {
            var result0 = null;
            pos = savedPos0;
          }



          cache[cacheKey] = {
            nextPos: pos,
            result:  result0
          };
          return result0;
        }

        function parse_offsetPattern() {
          var cacheKey = 'offsetPattern@' + pos;
          var cachedResult = cache[cacheKey];
          if (cachedResult) {
            pos = cachedResult.nextPos;
            return cachedResult.result;
          }


          var savedPos0 = pos;
          var savedPos1 = pos;
          var result3 = parse__();
          if (result3 !== null) {
            if (input.substr(pos, 6) === "offset") {
              var result4 = "offset";
              pos += 6;
            } else {
              var result4 = null;
              if (reportMatchFailures) {
                matchFailed("\"offset\"");
              }
            }
            if (result4 !== null) {
              var result5 = parse__();
              if (result5 !== null) {
                if (input.substr(pos, 1) === ":") {
                  var result6 = ":";
                  pos += 1;
                } else {
                  var result6 = null;
                  if (reportMatchFailures) {
                    matchFailed("\":\"");
                  }
                }
                if (result6 !== null) {
                  var result7 = parse__();
                  if (result7 !== null) {
                    var result8 = parse_digits();
                    if (result8 !== null) {
                      var result9 = parse__();
                      if (result9 !== null) {
                        var result1 = [result3, result4, result5, result6, result7, result8, result9];
                      } else {
                        var result1 = null;
                        pos = savedPos1;
                      }
                    } else {
                      var result1 = null;
                      pos = savedPos1;
                    }
                  } else {
                    var result1 = null;
                    pos = savedPos1;
                  }
                } else {
                  var result1 = null;
                  pos = savedPos1;
                }
              } else {
                var result1 = null;
                pos = savedPos1;
              }
            } else {
              var result1 = null;
              pos = savedPos1;
            }
          } else {
            var result1 = null;
            pos = savedPos1;
          }
          var result2 = result1 !== null
          ? (function(d) {
            return d;
          })(result1[5])
          : null;
          if (result2 !== null) {
            var result0 = result2;
          } else {
            var result0 = null;
            pos = savedPos0;
          }



          cache[cacheKey] = {
            nextPos: pos,
            result:  result0
          };
          return result0;
        }

        function parse_selectFormatPattern() {
          var cacheKey = 'selectFormatPattern@' + pos;
          var cachedResult = cache[cacheKey];
          if (cachedResult) {
            pos = cachedResult.nextPos;
            return cachedResult.result;
          }


          var savedPos0 = pos;
          var result1 = [];
          var result3 = parse_pluralForms();
          while (result3 !== null) {
            result1.push(result3);
            var result3 = parse_pluralForms();
          }
          var result2 = result1 !== null
          ? (function(pf) {
            return {
              type: "selectFormatPattern",
              pluralForms: pf
            };
          })(result1)
          : null;
          if (result2 !== null) {
            var result0 = result2;
          } else {
            var result0 = null;
            pos = savedPos0;
          }



          cache[cacheKey] = {
            nextPos: pos,
            result:  result0
          };
          return result0;
        }

        function parse_pluralForms() {
          var cacheKey = 'pluralForms@' + pos;
          var cachedResult = cache[cacheKey];
          if (cachedResult) {
            pos = cachedResult.nextPos;
            return cachedResult.result;
          }


          var savedPos0 = pos;
          var savedPos1 = pos;
          var result3 = parse__();
          if (result3 !== null) {
            var result4 = parse_stringKey();
            if (result4 !== null) {
              var result5 = parse__();
              if (result5 !== null) {
                if (input.substr(pos, 1) === "{") {
                  var result6 = "{";
                    pos += 1;
                  } else {
                    var result6 = null;
                    if (reportMatchFailures) {
                      matchFailed("\"{\"");
                      }
                    }
                    if (result6 !== null) {
                      var result7 = parse__();
                      if (result7 !== null) {
                        var result8 = parse_messageFormatPattern();
                        if (result8 !== null) {
                          var result9 = parse__();
                          if (result9 !== null) {
                            if (input.substr(pos, 1) === "}") {
                              var result10 = "}";
                              pos += 1;
                        } else {
                          var result10 = null;
                          if (reportMatchFailures) {
                            matchFailed("\"}\"");
                        }
                      }
                      if (result10 !== null) {
                        var result1 = [result3, result4, result5, result6, result7, result8, result9, result10];
                      } else {
                        var result1 = null;
                        pos = savedPos1;
                      }
                    } else {
                      var result1 = null;
                      pos = savedPos1;
                    }
                  } else {
                    var result1 = null;
                    pos = savedPos1;
                  }
                } else {
                  var result1 = null;
                  pos = savedPos1;
                }
                } else {
                  var result1 = null;
                  pos = savedPos1;
                }
              } else {
                var result1 = null;
                pos = savedPos1;
              }
            } else {
              var result1 = null;
              pos = savedPos1;
            }
          } else {
            var result1 = null;
            pos = savedPos1;
          }
          var result2 = result1 !== null
          ? (function(k, mfp) {
            return {
              type: "pluralForms",
              key: k,
              val: mfp
            };
          })(result1[1], result1[5])
          : null;
          if (result2 !== null) {
            var result0 = result2;
          } else {
            var result0 = null;
            pos = savedPos0;
          }



          cache[cacheKey] = {
            nextPos: pos,
            result:  result0
          };
          return result0;
        }

        function parse_stringKey() {
          var cacheKey = 'stringKey@' + pos;
          var cachedResult = cache[cacheKey];
          if (cachedResult) {
            pos = cachedResult.nextPos;
            return cachedResult.result;
          }


          var savedPos2 = pos;
          var result7 = parse_id();
          var result8 = result7 !== null
          ? (function(i) {
            return i;
          })(result7)
          : null;
          if (result8 !== null) {
            var result6 = result8;
          } else {
            var result6 = null;
            pos = savedPos2;
          }
          if (result6 !== null) {
            var result0 = result6;
          } else {
            var savedPos0 = pos;
            var savedPos1 = pos;
            if (input.substr(pos, 1) === "=") {
              var result4 = "=";
              pos += 1;
            } else {
              var result4 = null;
              if (reportMatchFailures) {
                matchFailed("\"=\"");
              }
            }
            if (result4 !== null) {
              var result5 = parse_digits();
              if (result5 !== null) {
                var result2 = [result4, result5];
              } else {
                var result2 = null;
                pos = savedPos1;
              }
            } else {
              var result2 = null;
              pos = savedPos1;
            }
            var result3 = result2 !== null
            ? (function(d) {
              return d;
            })(result2[1])
            : null;
            if (result3 !== null) {
              var result1 = result3;
            } else {
              var result1 = null;
              pos = savedPos0;
            }
            if (result1 !== null) {
              var result0 = result1;
            } else {
              var result0 = null;;
            };
          }



          cache[cacheKey] = {
            nextPos: pos,
            result:  result0
          };
          return result0;
        }

        function parse_string() {
          var cacheKey = 'string@' + pos;
          var cachedResult = cache[cacheKey];
          if (cachedResult) {
            pos = cachedResult.nextPos;
            return cachedResult.result;
          }


          var savedPos0 = pos;
          var savedPos1 = pos;
          var result3 = parse__();
          if (result3 !== null) {
            var result4 = [];
            var savedPos2 = pos;
            var result6 = parse__();
            if (result6 !== null) {
              var result7 = parse_chars();
              if (result7 !== null) {
                var result8 = parse__();
                if (result8 !== null) {
                  var result5 = [result6, result7, result8];
                } else {
                  var result5 = null;
                  pos = savedPos2;
                }
              } else {
                var result5 = null;
                pos = savedPos2;
              }
            } else {
              var result5 = null;
              pos = savedPos2;
            }
            while (result5 !== null) {
              result4.push(result5);
              var savedPos2 = pos;
              var result6 = parse__();
              if (result6 !== null) {
                var result7 = parse_chars();
                if (result7 !== null) {
                  var result8 = parse__();
                  if (result8 !== null) {
                    var result5 = [result6, result7, result8];
                  } else {
                    var result5 = null;
                    pos = savedPos2;
                  }
                } else {
                  var result5 = null;
                  pos = savedPos2;
                }
              } else {
                var result5 = null;
                pos = savedPos2;
              }
            }
            if (result4 !== null) {
              var result1 = [result3, result4];
            } else {
              var result1 = null;
              pos = savedPos1;
            }
          } else {
            var result1 = null;
            pos = savedPos1;
          }
          var result2 = result1 !== null
          ? (function(ws, s) {
            var tmp = [];
            for( var i = 0; i < s.length; ++i ) {
              for( var j = 0; j < s[ i ].length; ++j ) {
                tmp.push(s[i][j]);
              }
            }
            return {
              type: "string",
              val: ws + tmp.join('')
            };
          })(result1[0], result1[1])
          : null;
          if (result2 !== null) {
            var result0 = result2;
          } else {
            var result0 = null;
            pos = savedPos0;
          }



          cache[cacheKey] = {
            nextPos: pos,
            result:  result0
          };
          return result0;
        }

        function parse_id() {
          var cacheKey = 'id@' + pos;
          var cachedResult = cache[cacheKey];
          if (cachedResult) {
            pos = cachedResult.nextPos;
            return cachedResult.result;
          }


          var savedPos0 = pos;
          var savedPos1 = pos;
          var result3 = parse__();
          if (result3 !== null) {
            if (input.substr(pos).match(/^[a-zA-Z$_]/) !== null) {
              var result4 = input.charAt(pos);
              pos++;
            } else {
              var result4 = null;
              if (reportMatchFailures) {
                matchFailed("[a-zA-Z$_]");
              }
            }
            if (result4 !== null) {
              var result5 = [];
              if (input.substr(pos).match(/^[^ 	\n\r,.+={}]/) !== null) {
                var result7 = input.charAt(pos);
                pos++;
              } else {
                var result7 = null;
                if (reportMatchFailures) {
                  matchFailed("[^ 	\\n\\r,.+={}]");
                }
              }
              while (result7 !== null) {
                result5.push(result7);
                if (input.substr(pos).match(/^[^ 	\n\r,.+={}]/) !== null) {
                  var result7 = input.charAt(pos);
                  pos++;
                } else {
                  var result7 = null;
                  if (reportMatchFailures) {
                    matchFailed("[^ 	\\n\\r,.+={}]");
                  }
                }
              }
              if (result5 !== null) {
                var result6 = parse__();
                if (result6 !== null) {
                  var result1 = [result3, result4, result5, result6];
                } else {
                  var result1 = null;
                  pos = savedPos1;
                }
              } else {
                var result1 = null;
                pos = savedPos1;
              }
            } else {
              var result1 = null;
              pos = savedPos1;
            }
          } else {
            var result1 = null;
            pos = savedPos1;
          }
          var result2 = result1 !== null
          ? (function(s1, s2) {
            return s1 + (s2 ? s2.join('') : '');
          })(result1[1], result1[2])
          : null;
          if (result2 !== null) {
            var result0 = result2;
          } else {
            var result0 = null;
            pos = savedPos0;
          }



          cache[cacheKey] = {
            nextPos: pos,
            result:  result0
          };
          return result0;
        }

        function parse_chars() {
          var cacheKey = 'chars@' + pos;
          var cachedResult = cache[cacheKey];
          if (cachedResult) {
            pos = cachedResult.nextPos;
            return cachedResult.result;
          }


          var savedPos0 = pos;
          var result3 = parse_char();
          if (result3 !== null) {
            var result1 = [];
            while (result3 !== null) {
              result1.push(result3);
              var result3 = parse_char();
            }
          } else {
            var result1 = null;
          }
          var result2 = result1 !== null
          ? (function(chars) { return chars.join(''); })(result1)
          : null;
          if (result2 !== null) {
            var result0 = result2;
          } else {
            var result0 = null;
            pos = savedPos0;
          }



          cache[cacheKey] = {
            nextPos: pos,
            result:  result0
          };
          return result0;
        }

        function parse_char() {
          var cacheKey = 'char@' + pos;
          var cachedResult = cache[cacheKey];
          if (cachedResult) {
            pos = cachedResult.nextPos;
            return cachedResult.result;
          }


          var savedPos5 = pos;
          if (input.substr(pos).match(/^[^{}\\\0- 	\n\r]/) !== null) {
            var result19 = input.charAt(pos);
            pos++;
          } else {
            var result19 = null;
            if (reportMatchFailures) {
              matchFailed("[^{}\\\\\\0- 	\\n\\r]");
            }
          }
          var result20 = result19 !== null
          ? (function(x) {
            return x;
          })(result19)
          : null;
          if (result20 !== null) {
            var result18 = result20;
          } else {
            var result18 = null;
            pos = savedPos5;
          }
          if (result18 !== null) {
            var result0 = result18;
          } else {
            var savedPos4 = pos;
            if (input.substr(pos, 2) === "\\#") {
              var result16 = "\\#";
              pos += 2;
            } else {
              var result16 = null;
              if (reportMatchFailures) {
                matchFailed("\"\\\\#\"");
              }
            }
            var result17 = result16 !== null
            ? (function() {
              return "\\#";
            })()
            : null;
            if (result17 !== null) {
              var result15 = result17;
            } else {
              var result15 = null;
              pos = savedPos4;
            }
            if (result15 !== null) {
              var result0 = result15;
            } else {
              var savedPos3 = pos;
              if (input.substr(pos, 2) === "\\{") {
                var result13 = "\\{";
                  pos += 2;
                } else {
                  var result13 = null;
                  if (reportMatchFailures) {
                    matchFailed("\"\\\\{\"");
                    }
                  }
                  var result14 = result13 !== null
                  ? (function() {
                    return "\u007B";
                  })()
                  : null;
                  if (result14 !== null) {
                    var result12 = result14;
                  } else {
                    var result12 = null;
                    pos = savedPos3;
                  }
                  if (result12 !== null) {
                    var result0 = result12;
                  } else {
                    var savedPos2 = pos;
                    if (input.substr(pos, 2) === "\\}") {
                      var result10 = "\\}";
                      pos += 2;
                } else {
                  var result10 = null;
                  if (reportMatchFailures) {
                    matchFailed("\"\\\\}\"");
                }
              }
              var result11 = result10 !== null
              ? (function() {
                return "\u007D";
              })()
              : null;
              if (result11 !== null) {
                var result9 = result11;
              } else {
                var result9 = null;
                pos = savedPos2;
              }
              if (result9 !== null) {
                var result0 = result9;
              } else {
                var savedPos0 = pos;
                var savedPos1 = pos;
                if (input.substr(pos, 2) === "\\u") {
                  var result4 = "\\u";
                  pos += 2;
                } else {
                  var result4 = null;
                  if (reportMatchFailures) {
                    matchFailed("\"\\\\u\"");
                  }
                }
                if (result4 !== null) {
                  var result5 = parse_hexDigit();
                  if (result5 !== null) {
                    var result6 = parse_hexDigit();
                    if (result6 !== null) {
                      var result7 = parse_hexDigit();
                      if (result7 !== null) {
                        var result8 = parse_hexDigit();
                        if (result8 !== null) {
                          var result2 = [result4, result5, result6, result7, result8];
                        } else {
                          var result2 = null;
                          pos = savedPos1;
                        }
                      } else {
                        var result2 = null;
                        pos = savedPos1;
                      }
                    } else {
                      var result2 = null;
                      pos = savedPos1;
                    }
                  } else {
                    var result2 = null;
                    pos = savedPos1;
                  }
                } else {
                  var result2 = null;
                  pos = savedPos1;
                }
                var result3 = result2 !== null
                ? (function(h1, h2, h3, h4) {
                  return String.fromCharCode(parseInt("0x" + h1 + h2 + h3 + h4));
                })(result2[1], result2[2], result2[3], result2[4])
                : null;
                if (result3 !== null) {
                  var result1 = result3;
                } else {
                  var result1 = null;
                  pos = savedPos0;
                }
                if (result1 !== null) {
                  var result0 = result1;
                } else {
                  var result0 = null;;
                };
              };
              };
            };
          }



          cache[cacheKey] = {
            nextPos: pos,
            result:  result0
          };
          return result0;
        }

        function parse_digits() {
          var cacheKey = 'digits@' + pos;
          var cachedResult = cache[cacheKey];
          if (cachedResult) {
            pos = cachedResult.nextPos;
            return cachedResult.result;
          }


          var savedPos0 = pos;
          if (input.substr(pos).match(/^[0-9]/) !== null) {
            var result3 = input.charAt(pos);
            pos++;
          } else {
            var result3 = null;
            if (reportMatchFailures) {
              matchFailed("[0-9]");
            }
          }
          if (result3 !== null) {
            var result1 = [];
            while (result3 !== null) {
              result1.push(result3);
              if (input.substr(pos).match(/^[0-9]/) !== null) {
                var result3 = input.charAt(pos);
                pos++;
              } else {
                var result3 = null;
                if (reportMatchFailures) {
                  matchFailed("[0-9]");
                }
              }
            }
          } else {
            var result1 = null;
          }
          var result2 = result1 !== null
          ? (function(ds) {
            return parseInt((ds.join('')), 10);
          })(result1)
          : null;
          if (result2 !== null) {
            var result0 = result2;
          } else {
            var result0 = null;
            pos = savedPos0;
          }



          cache[cacheKey] = {
            nextPos: pos,
            result:  result0
          };
          return result0;
        }

        function parse_hexDigit() {
          var cacheKey = 'hexDigit@' + pos;
          var cachedResult = cache[cacheKey];
          if (cachedResult) {
            pos = cachedResult.nextPos;
            return cachedResult.result;
          }


          if (input.substr(pos).match(/^[0-9a-fA-F]/) !== null) {
            var result0 = input.charAt(pos);
            pos++;
          } else {
            var result0 = null;
            if (reportMatchFailures) {
              matchFailed("[0-9a-fA-F]");
            }
          }



          cache[cacheKey] = {
            nextPos: pos,
            result:  result0
          };
          return result0;
        }

        function parse__() {
          var cacheKey = '_@' + pos;
          var cachedResult = cache[cacheKey];
          if (cachedResult) {
            pos = cachedResult.nextPos;
            return cachedResult.result;
          }

          var savedReportMatchFailures = reportMatchFailures;
          reportMatchFailures = false;
          var savedPos0 = pos;
          var result1 = [];
          var result3 = parse_whitespace();
          while (result3 !== null) {
            result1.push(result3);
            var result3 = parse_whitespace();
          }
          var result2 = result1 !== null
          ? (function(w) { return w.join(''); })(result1)
          : null;
          if (result2 !== null) {
            var result0 = result2;
          } else {
            var result0 = null;
            pos = savedPos0;
          }
          reportMatchFailures = savedReportMatchFailures;
          if (reportMatchFailures && result0 === null) {
            matchFailed("whitespace");
          }

          cache[cacheKey] = {
            nextPos: pos,
            result:  result0
          };
          return result0;
        }

        function parse_whitespace() {
          var cacheKey = 'whitespace@' + pos;
          var cachedResult = cache[cacheKey];
          if (cachedResult) {
            pos = cachedResult.nextPos;
            return cachedResult.result;
          }


          if (input.substr(pos).match(/^[ 	\n\r]/) !== null) {
            var result0 = input.charAt(pos);
            pos++;
          } else {
            var result0 = null;
            if (reportMatchFailures) {
              matchFailed("[ 	\\n\\r]");
            }
          }



          cache[cacheKey] = {
            nextPos: pos,
            result:  result0
          };
          return result0;
        }

        function buildErrorMessage() {
          function buildExpected(failuresExpected) {
            failuresExpected.sort();

            var lastFailure = null;
            var failuresExpectedUnique = [];
            for (var i = 0; i < failuresExpected.length; i++) {
              if (failuresExpected[i] !== lastFailure) {
                failuresExpectedUnique.push(failuresExpected[i]);
                lastFailure = failuresExpected[i];
              }
            }

            switch (failuresExpectedUnique.length) {
              case 0:
                return 'end of input';
              case 1:
                return failuresExpectedUnique[0];
              default:
                return failuresExpectedUnique.slice(0, failuresExpectedUnique.length - 1).join(', ')
              + ' or '
              + failuresExpectedUnique[failuresExpectedUnique.length - 1];
            }
          }

          var expected = buildExpected(rightmostMatchFailuresExpected);
          var actualPos = Math.max(pos, rightmostMatchFailuresPos);
          var actual = actualPos < input.length
          ? quote(input.charAt(actualPos))
          : 'end of input';

          return 'Expected ' + expected + ' but ' + actual + ' found.';
        }

        function computeErrorPosition() {
          /*
          * The first idea was to use |String.split| to break the input up to the
          * error position along newlines and derive the line and column from
          * there. However IE's |split| implementation is so broken that it was
          * enough to prevent it.
          */

          var line = 1;
          var column = 1;
          var seenCR = false;

          for (var i = 0; i <  rightmostMatchFailuresPos; i++) {
            var ch = input.charAt(i);
            if (ch === '\n') {
              if (!seenCR) { line++; }
              column = 1;
              seenCR = false;
            } else if (ch === '\r' | ch === '\u2028' || ch === '\u2029') {
              line++;
              column = 1;
              seenCR = true;
            } else {
              column++;
              seenCR = false;
            }
          }

          return { line: line, column: column };
        }



        var result = parseFunctions[startRule]();

        /*
        * The parser is now in one of the following three states:
        *
        * 1. The parser successfully parsed the whole input.
        *
        *    - |result !== null|
        *    - |pos === input.length|
        *    - |rightmostMatchFailuresExpected| may or may not contain something
        *
        * 2. The parser successfully parsed only a part of the input.
        *
        *    - |result !== null|
        *    - |pos < input.length|
        *    - |rightmostMatchFailuresExpected| may or may not contain something
        *
        * 3. The parser did not successfully parse any part of the input.
        *
        *   - |result === null|
        *   - |pos === 0|
        *   - |rightmostMatchFailuresExpected| contains at least one failure
        *
        * All code following this comment (including called functions) must
        * handle these states.
        */
        if (result === null || pos !== input.length) {
          var errorPosition = computeErrorPosition();
          throw new this.SyntaxError(
            buildErrorMessage(),
            errorPosition.line,
            errorPosition.column
          );
        }

        return result;
      },

      /* Returns the parser source code. */
      toSource: function() { return this._source; }
    };

    /* Thrown when a parser encounters a syntax error. */

    result.SyntaxError = function(message, line, column) {
      this.name = 'SyntaxError';
      this.message = message;
      this.line = line;
      this.column = column;
    };

    result.SyntaxError.prototype = Error.prototype;

    return result;
  })();

  MessageFormat.prototype.parse = function () {
    // Bind to itself so error handling works
    return mparser.parse.apply( mparser, arguments );
  };

  MessageFormat.prototype.precompile = function ( ast ) {
    var self = this,
        needOther = false,
        fp = {
      begin: 'function(d){\nvar r = "";\n',
      end  : "return r;\n}"
    };

    function interpMFP ( ast, data ) {
      // Set some default data
      data = data || {};
      var s = '', i, tmp, lastkeyname;

      switch ( ast.type ) {
        case 'program':
          return interpMFP( ast.program );
        case 'messageFormatPattern':
          for ( i = 0; i < ast.statements.length; ++i ) {
            s += interpMFP( ast.statements[i], data );
          }
          return fp.begin + s + fp.end;
        case 'messageFormatPatternRight':
          for ( i = 0; i < ast.statements.length; ++i ) {
            s += interpMFP( ast.statements[i], data );
          }
          return s;
        case 'messageFormatElement':
          data.pf_count = data.pf_count || 0;
          s += 'if(!d){\nthrow new Error("MessageFormat: No data passed to function.");\n}\n';
          if ( ast.output ) {
            s += 'r += d["' + ast.argumentIndex + '"];\n';
          }
          else {
            lastkeyname = 'lastkey_'+(data.pf_count+1);
            s += 'var '+lastkeyname+' = "'+ast.argumentIndex+'";\n';
            s += 'var k_'+(data.pf_count+1)+'=d['+lastkeyname+'];\n';
            s += interpMFP( ast.elementFormat, data );
          }
          return s;
        case 'elementFormat':
          if ( ast.key === 'select' ) {
            s += interpMFP( ast.val, data );
            s += 'r += (pf_' +
                 data.pf_count +
                 '[ k_' + (data.pf_count+1) + ' ] || pf_'+data.pf_count+'[ "other" ])( d );\n';
          }
          else if ( ast.key === 'plural' ) {
            s += interpMFP( ast.val, data );
            s += 'if ( pf_'+(data.pf_count)+'[ k_'+(data.pf_count+1)+' + "" ] ) {\n';
            s += 'r += pf_'+data.pf_count+'[ k_'+(data.pf_count+1)+' + "" ]( d ); \n';
            s += '}\nelse {\n';
            s += 'r += (pf_' +
                 data.pf_count +
                 '[ MessageFormat.locale["' +
                 self.fallbackLocale +
                 '"]( k_'+(data.pf_count+1)+' - off_'+(data.pf_count)+' ) ] || pf_'+data.pf_count+'[ "other" ] )( d );\n';
            s += '}\n';
          }
          return s;
        /* // Unreachable cases.
        case 'pluralStyle':
        case 'selectStyle':*/
        case 'pluralFormatPattern':
          data.pf_count = data.pf_count || 0;
          s += 'var off_'+data.pf_count+' = '+ast.offset+';\n';
          s += 'var pf_' + data.pf_count + ' = { \n';
          needOther = true;
          // We're going to simultaneously check to make sure we hit the required 'other' option.

          for ( i = 0; i < ast.pluralForms.length; ++i ) {
            if ( ast.pluralForms[ i ].key === 'other' ) {
              needOther = false;
            }
            if ( tmp ) {
              s += ',\n';
            }
            else{
              tmp = 1;
            }
            s += '"' + ast.pluralForms[ i ].key + '" : ' + interpMFP( ast.pluralForms[ i ].val,
          (function(){ var res = JSON.parse(JSON.stringify(data)); res.pf_count++; return res; })() );
          }
          s += '\n};\n';
          if ( needOther ) {
            throw new Error("No 'other' form found in pluralFormatPattern " + data.pf_count);
          }
          return s;
        case 'selectFormatPattern':

          data.pf_count = data.pf_count || 0;
          s += 'var off_'+data.pf_count+' = 0;\n';
          s += 'var pf_' + data.pf_count + ' = { \n';
          needOther = true;

          for ( i = 0; i < ast.pluralForms.length; ++i ) {
            if ( ast.pluralForms[ i ].key === 'other' ) {
              needOther = false;
            }
            if ( tmp ) {
              s += ',\n';
            }
            else{
              tmp = 1;
            }
            s += '"' + ast.pluralForms[ i ].key + '" : ' + interpMFP( ast.pluralForms[ i ].val,
              (function(){
                var res = JSON.parse( JSON.stringify( data ) );
                res.pf_count++;
                return res;
              })()
            );
          }
          s += '\n};\n';
          if ( needOther ) {
            throw new Error("No 'other' form found in selectFormatPattern " + data.pf_count);
          }
          return s;
        /* // Unreachable
        case 'pluralForms':
        */
        case 'string':
          return 'r += "' + MessageFormat.Utils.numSub(
            MessageFormat.Utils.escapeExpression( ast.val ),
            'k_' + data.pf_count + ' - off_' + ( data.pf_count - 1 ),
            data.pf_count
          ) + '";\n';
        default:
          throw new Error( 'Bad AST type: ' + ast.type );
      }
    }
    return interpMFP( ast );
  };

  MessageFormat.prototype.compile = function ( message ) {
    return (new Function( 'MessageFormat',
      'return ' +
        this.precompile(
          this.parse( message )
        )
    ))(MessageFormat);
  };


  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = MessageFormat;
    }
    exports.MessageFormat = MessageFormat;
  }
  else if (typeof define === 'function' && define.amd) {
    define(function() {
      return MessageFormat;
    });
  }
  else {
    root['MessageFormat'] = MessageFormat;
  }

})( this );

},{}]},{},[12])


