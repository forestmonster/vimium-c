// Generated by CoffeeScript 1.8.0
(function() {
  "use strict";
  var BackgroundCommands, checkKeyQueue, completers, completionSources, copyToClipboard, currentVersion //
    , fetchFileContents, filterCompleter, frameIdsForTab, generateCompletionKeys, ContentTempSettings //
    , getActualKeyStrokeLength, getCompletionKeysRequest, getCurrentTabUrl, filesContent //
    , /* getCurrentTimeInSeconds, */ handleFrameFocused, handleMainPort //
    , helpDialogHtmlForCommandGroup, isEnabledForUrl, keyQueue, moveTab, namedKeyRegex //
    , openOptionsPageInNewTab, openUrlInCurrentTab, openUrlInIncognito, openMultiTab //
    , populateKeyCommands, portHandlers, refreshCompleter, registerFrame, splitKeyQueueRegex //
    , removeTabsRelative, root, saveHelpDialogSettings, selectSpecificTab, selectTab //
    , listenersAppended, requestHandlers, sendRequestToAllTabs //
    , shouldShowUpgradeMessage, singleKeyCommands, splitKeyIntoFirstAndSecond, splitKeyQueue, tabInfoMap //
    , tabLoadedHandlers, tabQueue, unregisterFrame, updateOpenTabs //
    , updatePositionsAndWindowsForAllTabsInWindow, upgradeNotificationClosed //
    , validFirstKeys, showActionIcon, onActiveChanged;

  root = typeof exports !== "undefined" && exports !== null ? exports : window;

  showActionIcon = chrome.browserAction && chrome.browserAction.setIcon ? true : false;

  currentVersion = Utils.getCurrentVersion();

  root.tabQueue = tabQueue = {};

  root.tabInfoMap = tabInfoMap = {};

  keyQueue = "";

  validFirstKeys = {};

  singleKeyCommands = [];

  frameIdsForTab = {};

  namedKeyRegex = /^(<(?:[amc]-.|(?:[amc]-)?[a-z0-9]{2,5})>)(.*)$/;

  listenersAppended = {};

  tabLoadedHandlers = {};
  
  filesContent = {};

  completionSources = {
    bookmarks: new BookmarkCompleter(),
    history: new HistoryCompleter(),
    domains: new DomainCompleter(),
    tabs: new TabCompleter(),
    seachEngines: new SearchEngineCompleter()
  };

  completers = {
    omni: new MultiCompleter([completionSources.seachEngines, completionSources.bookmarks, completionSources.history, completionSources.domains]),
    bookmarks: new MultiCompleter([completionSources.bookmarks]),
    history: new MultiCompleter([completionSources.history]),
    tabs: new MultiCompleter([completionSources.tabs])
  };

  chrome.runtime.onConnect.addListener(function(port) {
    var handler = portHandlers[port.name];
    if (handler) {
      port.onMessage.addListener(handler);
    } else {
      port.disconnect();
    }
  });

  getCurrentTabUrl = function(request, tab) {
    return tab.url;
  };

  isEnabledForUrl = function(request) {
    var rule = Exclusions.getRule(request.url), ret;
    if (rule && !rule.passKeys) {
      return {
        enabled: false
      };
    } else {
      ret = getCompletionKeysRequest();
      ret.enabled = true;
      ret.passKeys = rule ? rule.passKeys : ""
      delete ret.name;
      return ret;
    }
  };

  saveHelpDialogSettings = function(request) {
    Settings.set("helpDialog_showAdvancedCommands", request.showAdvancedCommands);
  };

  root.helpDialogHtml = function(showUnboundCommands, showCommandNames, customTitle) {
    var command, commandsToKey, dialogHtml, group, key;
    commandsToKey = {};
    for (key in Commands.keyToCommandRegistry) {
      command = Commands.keyToCommandRegistry[key].command;
      commandsToKey[command] = (commandsToKey[command] || []).concat(key);
    }
    //*
    dialogHtml = filesContent.helpDialog || (filesContent.helpDialog = fetchFileContents("pages/help_dialog.html"));
    /*/
    dialogHtml = fetchFileContents("pages/help_dialog.html");
    //*/
    return dialogHtml.replace(new RegExp("\\{\\{(version|title|" + Object.keys(Commands.commandGroups).join('|') + ")\\}\\}", "g"), function(_, group) {
      return (group === "version") ? currentVersion
        : (group === "title") ? (customTitle || "Help")
        : helpDialogHtmlForCommandGroup(group, commandsToKey, Commands.availableCommands, showUnboundCommands, showCommandNames);
    });
  };

  helpDialogHtmlForCommandGroup = function(group, commandsToKey, availableCommands, showUnboundCommands, showCommandNames) {
    var bindings, command, html, isAdvanced, _i, _len, _ref;
    html = [];
    _ref = Commands.commandGroups[group];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      command = _ref[_i];
      bindings = (commandsToKey[command] || [""]).join(", ");
      if (showUnboundCommands || commandsToKey[command]) {
        isAdvanced = Commands.advancedCommands.indexOf(command) >= 0;
        html.push("<tr class='vimB vimI vimiumHelpTr" + (isAdvanced ? " vimiumHelpAdvanced" : "")
          , "'>\n\t<td class='vimB vimI vimiumHelpTd vimiumHelpShortKey'>\n\t\t<span class='vimB vimI vimiumHelpShortKey2'>", Utils.escapeHtml(bindings)
          , "</span>\n\t</td>\n\t<td class='vimB vimI vimiumHelpTd'>:</td>\n\t<td class='vimB vimI vimiumHelpTd vimiumHelpCommandInfo'>"
          , Utils.escapeHtml(availableCommands[command].description));
        if (showCommandNames) {
          html.push("\n\t\t<span class='vimB vimI vimiumHelpCommandName'>(" + command + ")</span>");
        }
        html.push("</td>\n</tr>\n");
      }
    }
    return html.join("");
  };

  fetchFileContents = function(extensionFileName) {
    var req = new XMLHttpRequest();
    req.open("GET", chrome.runtime.getURL(extensionFileName), false);
    req.send();
    return req.responseText;
  };

  getCompletionKeysRequest = function() {
    return {
      name: "refreshCompletionKeys",
      completionKeys: generateCompletionKeys(),
      keyQueue: keyQueue,
      validFirstKeys: validFirstKeys
    };
  };

  openUrlInCurrentTab = function(request, tab, _2, callback) {
    chrome.tabs.update(tab.id, {
      url: Utils.convertToUrl(request.url)
    }, callback);
  };

  openMultiTab = function(rawUrl, index, count, windowId, active) {
    var option = {
      url: rawUrl,
      windowId: windowId,
      index: index,
      selected: active !== false
    };
    while(--count >= 0) {
      chrome.tabs.create(option);
      ++option.index;
      option.selected = false;
    }
  };

  openUrlInIncognito = function(request) {
    chrome.windows.create({
      url: Utils.convertToUrl(request.url),
      incognito: true
    });
  };

  upgradeNotificationClosed = function(request) {
    Settings.set("previousVersion", currentVersion);
    sendRequestToAllTabs({
      name: "hideUpgradeNotification"
    });
  };

  copyToClipboard = function(request) {
    Clipboard.copy(request.data);
  };

  ContentTempSettings = {
    ensure: function (contentType, tab) {
      if (!Utils.hasOrdinaryUrlPrefix(tab.url) || tab.url.startsWith("chrome")) {
        return;
      }
      var pattern = tab.url;
      if (!pattern.startsWith("file:")) {
        pattern = /^[a-z]+:\/\/[^\/]+\//.exec(tab.url)[0] + "*";
      }
      var work = this.ensureSetAndUpdate.bind(this, contentType, tab, pattern);
      chrome.contentSettings[contentType].get({
        primaryUrl: tab.url,
        incognito: true
      }, function(opt) {
        if (!chrome.lastError && opt) {
          if (opt.setting === "allow") { return; }
          work();
          return;
        }
        delete chrome.lastError;
        chrome.contentSettings[contentType].get({primaryUrl: tab.url}, function (opt) {
          if (opt && opt.setting === "allow") { return; }
          work();
        });
      });
    },
    ensureSetAndUpdate: function(contentType, tab, pattern) {
      var _this = this, work = function (wndId, tabIndex, callback) {
        _this.setAllowInIncognito(contentType, pattern, function () {
          _this.updateTab(tab, wndId, tabIndex, callback);
        });
      };
      chrome.windows.getAll(function(wnds) {
        wnds = wnds || [];
        if (wnds.length > 0) {
          wnds = wnds.filter(function(wnd) {
            return wnd.type === "normal" && wnd.incognito;
          });
        }
        if (wnds.length === 0) {
          chrome.windows.create({
            type: "normal",
            incognito: true,
            url: Settings.ChromeInnerNewTab
          }, function (wnd) {
            var left = wnd.tabs[0].id;
            work(wnd.id, 1, function() {
              chrome.tabs.remove(left);
            });
          });
          return;
        }
        if (wnds.filter(function(wnd) {return wnd.id === tab.windowId;}).length > 0) {
          work(tab.windowId, tab.index);
          return;
        }
        var wnd = wnds[wnds.length - 1];
        chrome.tabs.getAllInWindow(wnd.id, function(tabs) {
          work(wnd.id, tabs.length);
        });
      });
    },
    setAllowInIncognito: function(contentType, pattern, callback) {
      chrome.contentSettings[contentType].set({
        primaryPattern: pattern,
        scope: "incognito_session_only",
        setting: "allow"
      }, typeof callback === "function" ? callback : null);
    },
    updateTab: function(tab, newWindowId, newTabIndex, callback) {
      if (tab.windowId === newWindowId) {
        chrome.tabs.update(tab.id, {
          selected: true,
          url: tab.url
        }, callback);
      } else if (tab.incognito) {
        chrome.tabs.move(tab.id, {
          windowId: newWindowId,
          index: newTabIndex
        }, function () {
          chrome.tabs.update(tab.id, {
            selected: true,
            url: tab.url
          }, callback);
        });
      } else {
        chrome.tabs.create({
          windowId: newWindowId,
          index: newTabIndex,
          selected: true,
          url: tab.url
        }, function () {
          chrome.tabs.remove(tab.id);
          callback && callback();
        });
      }
    }
  };

  selectSpecificTab = function(request) {
    chrome.tabs.get(request.sessionId, function(tab) {
      chrome.windows.update(tab.windowId, {
        focused: true
      });
      chrome.tabs.update(request.sessionId, {
        selected: true
      });
    });
  };

  refreshCompleter = function(request) {
    completers[request.name].refresh();
  };
  
  filterCompleter = function(args, port) {
    completers[args.name].filter(args.query ? args.query.trim().split(/\s+/) : [], function(results) {
      port.postMessage({
        id: args.id,
        results: results
      });
    });
  };

  /* getCurrentTimeInSeconds = function() {
    return Math.floor((new Date()).getTime() / 1000);
  }; */

  /* chrome.tabs.onSelectionChanged.addListener(function(tabId, selectionInfo) {
    if (selectionChangedHandlers.length > 0) {
      var callback = selectionChangedHandlers.pop();
      if (callback) {
        callback();
      }
    }
  }); */

  /* repeatFunction = function(func, totalCount, tab, currentCount, frameId, port) {
    var callback;
    if (currentCount < totalCount) {
      if (++currentCount < totalCount) {
        callback = function(newTab) {
          func(newTab || tab, ++currentCount < totalCount ? callback : null, frameId, port);
        };
      }
      func(tab, callback, frameId, port);
    }
  }; */

  // function (const Tab tab, const int repeatCount, const int frameId, const Port port);
  BackgroundCommands = {
    createTab: function(tab, count) {
      chrome.windows.get(tab.windowId, function(wnd) {
        var url = Settings.get("newTabUrl");
        if (!(wnd.incognito && Utils.isRefuseIncognito(url))) {
          openMultiTab(url, tab.index + 1, count, tab.windowId);
          return;
        }
        // this url will be disabled if opened in a incognito window directly
        chrome.tabs.getAllInWindow(tab.windowId, function(allTabs) {
          var urlLower = url.toLowerCase().split('#', 1)[0],
            repeat = count > 1 ? function(tab1) {
              var left = count;
              while (--left > 0) {
                chrome.tabs.duplicate(tab1.id);
              }
            } : null;
          if (urlLower.indexOf("://") < 0) {
            urlLower = chrome.runtime.getURL(urlLower);
          }
          allTabs = allTabs.filter(function(tab1) {
            var url = tab1.url.toLowerCase(), end = url.indexOf("#");
            return ((end < 0) ? url : url.substring(0, end)) === urlLower;
          });
          if (allTabs.length > 0) {
            urlLower = allTabs.filter(function(tab1) {
              return tab1.index >= tab.index;
            });
            tab = (urlLower.length > 0) ? urlLower[0] : allTabs[allTabs.length - 1];
            chrome.tabs.duplicate(tab.id);
            repeat && repeat(tab);
            return;
          }
          chrome.tabs.create({
            selected: false,
            url: url
          }, function(newTab) {
            chrome.windows.create({
              left: 0,
              top: 0,
              width: 50,
              height: 50,
              incognito: true,
              tabId: newTab.id
            }, function() {
              chrome.tabs.move(newTab.id, {
                index: tab.index + 1,
                windowId: tab.windowId
              }, function() {
                if (repeat) {
                  repeat(newTab);
                }
                chrome.tabs.update(newTab.id, {
                  selected: true 
                });
              });
            });
          });
        });
      });
    },
    duplicateTab: function(tab, count) {
      chrome.tabs.duplicate(tab.id);
      if (!(count > 1)) {
        return;
      }
      chrome.windows.get(tab.windowId, function(wnd) {
        if (wnd.incognito && Utils.isRefuseIncognito(url)) {
          while (--count > 0) {
            chrome.tabs.duplicate(tab.id);
          }
        } else {
          openMultiTab(tab.url, tab.index + 2, count - 1, tab.windowId, false);
        }
      });
    },
    moveTabToNewWindow: function(tab) {
      chrome.windows.get(tab.windowId, function(wnd) {
        chrome.windows.create({
          tabId: tab.id,
          incognito: tab.url.startsWith("chrome") ? false : tab.incognito
        });
      });
    },
    moveTabToIncognito: function(tab) {
      chrome.windows.get(tab.windowId, function(wnd) {
        if (wnd.incognito && tab.incognito) { return; }
        var options = {
          type: "normal",
          incognito: true
        }, url = tab.url;
        if (url.startsWith("chrome") && url.toLowerCase() !== Settings.ChromeInnerNewTab) {
          if (wnd.incognito) { return; }
          options.tabId = tab.id;
        } else if (tab.incognito) {
          options.tabId = tab.id;
          return;
        } else {
          options.url = url;
        }
        chrome.windows.create(options);
        if (!("tabId" in options)) {
          chrome.tabs.remove(tab.id);
        }
      });
    },
    enableImageTemp: function(tab) {
      ContentTempSettings.ensure("images", tab);
    },
    nextTab: function(tab, count) {
      selectTab(tab, count);
    },
    previousTab: function(tab, count) {
      selectTab(tab, -count);
    },
    firstTab: function(tab) {
      selectTab(tab, -tab.index);
    },
    lastTab: function(tab) {
      selectTab(tab, -tab.index - 1);
    },
    removeTab: function(tab, count) {
      if (!tab || tab.index > 1) {
        if (count > 1) {
          removeTabsRelative(tab, count);
        } else {
          chrome.tabs.remove(tab.id);
        }
        return;
      }
      chrome.tabs.getAllInWindow(tab.windowId, function(curTabs) {
        if (!curTabs || curTabs.length > count) {
          if (count > 1) {
            removeTabsRelative(tab, count);
          } else {
            chrome.tabs.remove(tab.id);
          }
          return;
        }
        chrome.windows.getAll(function(wnds) {
          var url = Settings.get("newTabUrl"), toCreate;
          wnds = wnds.filter(function(wnd) {
            return wnd.type === "normal";
          });
          if (wnds.length <= 1) {
            // retain the last window
            toCreate = {};
            if (wnds.length === 1 && wnds[0].incognito && !Utils.isRefuseIncognito(url)) {
              toCreate.windowId = wnds[0].id;
            }
            // other urls will be disabled if incognito
          }
          else if (! tab.incognito) {
            // retain the last normal window which has currentTab
            wnds = wnds.filter(function(wnd) {
              return ! wnd.incognito;
            });
            if (wnds.length === 1 && wnds[0].id === tab.windowId) {
              toCreate = { windowId: tab.windowId };
            }
          }
          curTabs = (count > 1) ? curTabs.filter(function(tab) {
            return !tab.pinned;
          }).map(function(tab) {
            return tab.id;
          }) : [tab.id];
          if (toCreate) {
            toCreate.url = url;
            chrome.tabs.create(toCreate);
          }
          if (curTabs.length > 0) {
            chrome.tabs.remove(curTabs);
          }
        });
      });
    },
    restoreTab: function(tab, count, _2, _3, sessionId) {
      if (chrome.sessions) {
        if (sessionId) {
          chrome.sessions.restore(sessionId);
        } else {
          while (--count >= 0) {
            chrome.sessions.restore();
          }
        }
        return;
      }
      var tabs, tabQ = tabQueue[tab.windowId];
      if (!(tabQ && tabQ.length > 0)) {
        return;
      }
      if (typeof sessionId === "number" && sessionId >= 0 && sessionId < tabQ.length) {
        tabs = tabQ.splice(sessionId, 1);
      } else if (count >= 1) {
        tabs = tabQ.splice(-count);
      } else {
        tabs = [tabQ.pop()];
      }
      if (tabQ.length === 0) {
        delete tabQueue[tab.windowId];
      }
      tabs.forEach(function(tabQueueEntry) {
        var x = tabQueueEntry.scrollX, y = tabQueueEntry.scrollY;
        chrome.tabs.create({
          url: tabQueueEntry.url,
          index: tabQueueEntry.positionIndex
        }, function(newTab) {
          tabLoadedHandlers[newTab.id] = function(port) {
            port.postMessage({
              name: "setScrollPosition",
              scrollX: x,
              scrollY: y
            });
          };
        });
      });
    },
    openCopiedUrlInCurrentTab: function(tab) {
      openUrlInCurrentTab({
        url: Clipboard.paste()
      }, tab);
    },
    openCopiedUrlInNewTab: function(tab, count) {
      openMultiTab(Utils.convertToUrl(Clipboard.paste()), tab.index + 1, count, tab.windowId);
    },
    togglePinTab: function(tab) {
      tab.pinned = !tab.pinned;
      chrome.tabs.update(tab.id, {
        pinned: tab.pinned
      });
    },
    showHelp: function(_0, _1, _2, port) {
      port.postMessage({
        name: "toggleHelpDialog",
        dialogHtml: helpDialogHtml(),
      });
    },
    moveTabLeft: function(tab, count) {
      moveTab(tab, -count);
    },
    moveTabRight: function(tab, count) {
      moveTab(tab, count);
    },
    nextFrame: function(tab, count, frameId) {
      var frames = frameIdsForTab[tab.id];
      count = (count + Math.max(0, frames.indexOf(frameId))) % frames.length;
      frames = frameIdsForTab[tab.id] = frames.slice(count).concat(frames.slice(0, count));
      chrome.tabs.sendMessage(tab.id, {
        name: "focusFrame",
        frameId: frames[0],
        highlight: true
      });
    },
    closeTabsOnLeft: function(tab) {
      removeTabsRelative(tab, -1);
    },
    closeTabsOnRight: function(tab) {
      removeTabsRelative(tab, 1);
    },
    closeOtherTabs: function(tab) {
      removeTabsRelative(tab, 0);
    }
  };

  removeTabsRelative = function(activeTab, direction) {
    chrome.tabs.getAllInWindow(activeTab.windowId, function(tabs) {
      var activeTabIndex, shouldDelete, tab, toRemove, _i, _len;
      activeTabIndex = activeTab.index;
      shouldDelete = (direction === -1) ? function(tab) {
        return !tab.pinned && tab.index < activeTabIndex;
      } : (direction === 1) ? function(tab) {
        return !tab.pinned && tab.index > activeTabIndex;
      } : (direction === 0) ? function(tab) {
        return !tab.pinned && tab.index !== activeTabIndex;
      } : (direction > 0) ? (direction += activeTabIndex, function(tab) {
        return !tab.pinned && tab.index >= activeTabIndex && tab.index < direction;
      }) : (direction < 0) ? (direction = activeTabIndex - direction, function(tab) {
        return !tab.pinned && tab.index <= activeTabIndex && tab.index > direction;
      }) : null;
      toRemove = [];
      if (shouldDelete) {
        tabs = tabs.filter(shouldDelete).map(function(tab) {
          return tab.id;
        });
        if (tabs.length > 0) {
          chrome.tabs.remove(tabs);
        }
      }
    });
  };

  moveTab = function(tab, direction) {
    tab.index = Math.max(0, tab.index + direction);
    chrome.tabs.move(tab.id, {
      index: tab.index
    });
  };

  selectTab = function(tab, step) {
    chrome.tabs.getAllInWindow(tab.windowId, function(tabs) {
      if (!(tabs.length > 1)) {
        return;
      }
      var toSelect = tabs[(tab.index + step + tabs.length) % tabs.length];
      chrome.tabs.update(toSelect.id, {
        selected: true
      });
    });
  };

  // function (tab = {id, url, title, index, windowId}) 
  updateOpenTabs = function(tab) {
    var _ref;
    if ((_ref = tabInfoMap[tab.id]) && _ref.deletor) {
      clearTimeout(_ref.deletor);
    }
    tabInfoMap[tab.id] = {
      url: tab.url,
      title: tab.title,
      positionIndex: tab.index,
      windowId: tab.windowId,
      scrollX: 0,
      scrollY: 0,
      deletor: 0
    };
    delete frameIdsForTab[tab.id];
  };

  root.setShowActionIcon = !showActionIcon ? function() {} : function(value) {
    value = chrome.browserAction && chrome.browserAction.setIcon && value ? true : false;
    if (value === showActionIcon) { return; }
    showActionIcon = value;
    // TODO: hide icon
    if (showActionIcon) {
      chrome.tabs.onActiveChanged.addListener(onActiveChanged);
      chrome.browserAction.enable();
    } else {
      chrome.tabs.onActiveChanged.removeListener(onActiveChanged);
      chrome.browserAction.disable();
    }
  };

  onActiveChanged = !showActionIcon ? function() {} : function(tabId, selectInfo) {
    chrome.tabs.get(tabId, function(tab) {
      updateActiveState(tabId, tab.url);
    });
  };

  root.updateActiveState = !showActionIcon ? function() {} : function(tabId, url) {
    if (!showActionIcon) return;
    chrome.tabs.sendMessage(tabId, {
      name: "getActiveState"
    }, function(response) {
      var config, currentPasskeys, enabled, isCurrentlyEnabled, passKeys;
      if (response) {
        isCurrentlyEnabled = response.enabled;
        currentPasskeys = response.passKeys;
        config = isEnabledForUrl({
          url: url
        });
        enabled = config.enabled;
        passKeys = config.passKeys;
        chrome.browserAction.setIcon({
          tabId: tabId,
          path: !enabled ? "img/icons/browser_action_disabled.png"
              : passKeys ? "img/icons/browser_action_partial.png"
                         : "img/icons/browser_action_enabled.png"
        })
        if (isCurrentlyEnabled !== enabled || currentPasskeys !== passKeys) {
          chrome.tabs.sendMessage(tabId, {
            name: "setState",
            enabled: enabled,
            passKeys: passKeys
          });
        }
      } else {
        chrome.browserAction.setIcon({
          tabId: tabId,
          path: "img/icons/browser_action_disabled.png"
        });
      }
    });
  };

  root.appendListener = function(name, func) {
    if (name !== "update") { return; }
    (listenersAppended[name] || (listenersAppended[name] = [])).append(func);
  };

  chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status !== "loading" || !changeInfo.url) { return; }
    if (Utils.isTabWithSameUrl(tabInfoMap[tabId], tab)) {
      tabInfoMap[tabId].url = changeInfo.url;
      // onActive will be triggered when a new page is loading.
      return;
    }
    updateOpenTabs(tab); /*
    var ref = listenersAppended.update, i;
    if (ref) {
      for (var i in ref)
        ref[i].call(null);
    } //*/
    Marks.removeMarksForTab(tabId);
    showActionIcon && updateActiveState(tab.id, tab.url);
  });

  chrome.tabs.onAttached.addListener(function(tabId, attachedInfo) {
    if (tabInfoMap[tabId]) {
      updatePositionsAndWindowsForAllTabsInWindow(tabInfoMap[tabId].windowId);
    }
    updatePositionsAndWindowsForAllTabsInWindow(attachedInfo.newWindowId);
  });

  chrome.tabs.onMoved.addListener(function(tabId, moveInfo) {
    updatePositionsAndWindowsForAllTabsInWindow(moveInfo.windowId);
  });

  chrome.tabs.onRemoved.addListener(function(tabId) {
    var i, openTabInfo, ref;
    openTabInfo = tabInfoMap[tabId];
    if (!openTabInfo || !(i = openTabInfo.windowId)) {
      return true;
    }
    updatePositionsAndWindowsForAllTabsInWindow(i);
    if (!chrome.sessions) {
      ref = tabQueue[i];
      if (!Utils.hasOrdinaryUrlPrefix(openTabInfo.url) || openTabInfo.url.startsWith("chrome")) {
        i = openTabInfo.positionIndex;
        for (var j in ref) {
          if (ref[j].positionIndex > i) {
            -- ref[j].positionIndex;
          }
        }
        /**/ return; /*/ i = openTabInfo.windowId; //*/
      }
      openTabInfo.lastVisitTime = new Date().getTime();
      if (ref) {
        ref.push(openTabInfo);
      } else {
        tabQueue[i] = [openTabInfo];
      }
    }
    openTabInfo.deletor = setTimeout(function() {
      delete tabInfoMap[tabId];
    }, 1000);
    delete frameIdsForTab[tabId];
  });

  if (!chrome.sessions) {
    chrome.windows.onRemoved.addListener(function(windowId) {
      delete tabQueue[windowId];
    });
  }

  updatePositionsAndWindowsForAllTabsInWindow = function(windowId) {
    chrome.tabs.getAllInWindow(windowId, function(tabs) {
      if (!tabs) return;
      var openTabInfo, tab, _i, _len;
      for (_i = 0, _len = tabs.length; _i < _len; _i++) {
        tab = tabs[_i];
        openTabInfo = tabInfoMap[tab.id];
        if (openTabInfo) {
          openTabInfo.positionIndex = tab.index;
          openTabInfo.windowId = tab.windowId;
        }
      }
    });
  };

  splitKeyIntoFirstAndSecond = function(key) {
    return (key.search(namedKeyRegex) === 0) ? {
      first: RegExp.$1,
      second: RegExp.$2
    } : {
      first: key[0],
      second: key.slice(1)
    };
  };

  getActualKeyStrokeLength = function(key) {
    if (key.search(namedKeyRegex) === 0) {
      return 1 + getActualKeyStrokeLength(RegExp.$2);
    } else {
      return key.length;
    }
  };

  populateKeyCommands = function() {
    var key, len;
    for (key in Commands.keyToCommandRegistry) {
      len = getActualKeyStrokeLength(key);
      if (len === 1) {
        singleKeyCommands.push(key);
      }
      else if (len === 2) {
        validFirstKeys[splitKeyIntoFirstAndSecond(key).first] = true;
      }
      else if (len >= 3) {
        console.warn("3-key command:", key);
      }
    }
  };

  root.refreshCompletionKeysAfterMappingSave = function() {
    validFirstKeys = {};
    singleKeyCommands = [];
    populateKeyCommands();
    sendRequestToAllTabs(getCompletionKeysRequest());
  };

  generateCompletionKeys = function() {
    if (keyQueue.length === 0) {
      return singleKeyCommands;
    }
    var command = splitKeyQueueRegex.exec(keyQueue)[2], completionKeys = singleKeyCommands.slice(0), key, splitKey;
    if (getActualKeyStrokeLength(command) === 1) {
      for (key in Commands.keyToCommandRegistry) {
        splitKey = splitKeyIntoFirstAndSecond(key);
        if (splitKey.first === command) {
          completionKeys.push(splitKey.second);
        }
      }
    }
    return completionKeys;
  };

  splitKeyQueueRegex = /([1-9][0-9]*)?(.*)/;

  splitKeyQueue = function(queue) {
    var match = splitKeyQueueRegex.exec(queue);
    return {
      count: parseInt(match[1], 10),
      command: match[2]
    };
  };

  handleMainPort = function(request, port) {
    var key, func, msgId = request._msgId;
    if (msgId) {
      request = request.request;
    }
    if (key = request.handlerKey) {
      if (key === "<ESC>") {
        msgId = "";
      } else {
        msgId = checkKeyQueue(keyQueue + key, port, request.frameId);
      }
      if (keyQueue !== msgId) {
        keyQueue = msgId;
        port.postMessage(getCompletionKeysRequest());
      }
    }
    else if (key = request.handler) {
      func = requestHandlers[key];
      if (func) {
        chrome.tabs.getSelected(null, function(tab) {
          var response = func(request, tab, port);
          if (msgId) {
            port.postMessage({
              name: "response",
              _msgId: msgId,
              response: response
            });
          }
        });
      }
    }
    else if (key = request.handlerSettings) {
      if (key === "get") {
        for (var i = 0, ref = request.keys, values = new Array(ref.length); i < ref.length; i++) {
          values[i] = Settings.get(ref[i]);
        }
        port.postMessage({
          name: "settings",
          keys: request.keys,
          values: values
        });
      } else if (key === "set") {
        Settings.set(request.key, request.value);
      }
    }
  };

  checkKeyQueue = function(keysToCheck, port, frameId) {
    var command, count, newKeyQueue, registryEntry, runCommand, splitHash, splitKey;
    splitHash = splitKeyQueue(keysToCheck);
    command = splitHash.command;
    count = splitHash.count;
    if (command.length === 0) {
      return keysToCheck;
    }
    if (isNaN(count)) {
      count = 1;
    }
    if (Commands.keyToCommandRegistry[command]) {
      registryEntry = Commands.keyToCommandRegistry[command];
      runCommand = true;
      if (registryEntry.noRepeat === true) {
        count = 1;
      } else if (registryEntry.noRepeat > 0 && count > registryEntry.noRepeat) {
        runCommand = confirm("You have asked Vimium to perform " + count + " repeats of the command:\n\t"
          + Commands.availableCommands[registryEntry.command].description
          + "\n\nAre you sure you want to continue?");
      }
      if (runCommand) {
        if (registryEntry.isBackgroundCommand) {
          chrome.tabs.getSelected(null, function(tab) {
            BackgroundCommands[registryEntry.command](tab, count, frameId, port);
          });
        } else {
          port.postMessage({
            name: "executePageCommand",
            command: registryEntry.command,
            frameId: frameId,
            count: (registryEntry.noRepeat === false) ? (-count) : count,
            keyQueue: "",
            completionKeys: generateCompletionKeys()
          });
          return keyQueue = "";
        }
      }
      newKeyQueue = "";
    } else if (getActualKeyStrokeLength(command) > 1) {
      splitKey = splitKeyIntoFirstAndSecond(command);
      if (Commands.keyToCommandRegistry[splitKey.second]) {
        newKeyQueue = checkKeyQueue(splitKey.second, port, frameId);
      } else {
        newKeyQueue = (validFirstKeys[splitKey.second] ? splitKey.second : "");
      }
    } else {
      newKeyQueue = (validFirstKeys[command] ? count.toString() + command : "");
    }
    return newKeyQueue;
  };

  sendRequestToAllTabs = function(args) {
    chrome.windows.getAll({
      populate: true
    }, function(windows) {
      var _i, _len, _j, _len1, _ref;
      for (_i = 0, _len = windows.length; _i < _len; _i++) {
        _ref = windows[_i].tabs;
        for (_j = 0, _len1 = _ref.length; _j < _len1; _j++) {
          chrome.tabs.sendMessage(_ref[_j].id, args, null);
        }
      }
    });
  };

  shouldShowUpgradeMessage = function() {
    if (!Settings.get("previousVersion")) {
      Settings.set("previousVersion", currentVersion);
      return false;
    }
    return Utils.compareVersions(currentVersion, Settings.get("previousVersion")) === 1;
  };

  openOptionsPageInNewTab = function(request, tab) {
    chrome.tabs.create({
      url: chrome.runtime.getURL("pages/options.html"),
      index: tab.index + 1
    });
  };

  registerFrame = function(request, tab, port) {
    var tabId = tab.id, css2, toCall;
    if (! isNaN(request.frameId)) {
      (frameIdsForTab[tabId] || (frameIdsForTab[tabId] = [])).push(request.frameId);
    }
    if (toCall = tabLoadedHandlers[tabId]) {
      delete tabLoadedHandlers[tabId];
      toCall(port);
    }
    css2 = Settings.get("userDefinedCss");
    css2 && chrome.tabs.insertCSS(tabId, {
      allFrames: true,
      code: css2
    }, function() {
      return chrome.runtime.lastError;
      // chrome.runtime.lastError && console.log("%c" + chrome.runtime.lastError.message, "color: red");
    });
    if (shouldShowUpgradeMessage()) {
      port.postMessage({
        name: "showUpgradeNotification",
        version: currentVersion
      });
    }
  };

  unregisterFrame = function(request, tab) {
    var tabId = tab.id;
    if (request.isTop) {
      updateOpenTabs(tab);
	  var ref = tabInfoMap[tabId];
      ref.scrollX = request.scrollX;
      ref.scrollY = request.scrollY;
    }
    else if (frameIdsForTab[tabId] != null) {
      frameIdsForTab[tabId] = frameIdsForTab[tabId].filter(function(id) {
        return id !== request.frameId;
      });
    }
  };

  handleFrameFocused = function(request, tab) {
    var frames = frameIdsForTab[tab.id];
    if (frames == null || frames.length <= 1) {
      return;
    }
    var ind = frames.indexOf(request.frameId);
    if (ind > 0) {
      frames.splice(ind, 1);
      frames.unshift(request.frameId);
    }
  };

  portHandlers = {
    main: handleMainPort,
    filterCompleter: filterCompleter
  };

  // function (request, Tab tab, const Port port);
  requestHandlers = {
    getCompletionKeys: getCompletionKeysRequest,
    getCurrentTabUrl: getCurrentTabUrl,
    openUrlInNewTab: function(request, tab) {
      openMultiTab(Utils.convertToUrl(request.url), tab.index + 1, 1, tab.windowId);
    },
    restoreSession: function(request, tab) {
      BackgroundCommands.restoreTab(null, null, null, null, request.sessionId);
    },
    openUrlInIncognito: openUrlInIncognito,
    openUrlInCurrentTab: openUrlInCurrentTab,
    openOptionsPageInNewTab: openOptionsPageInNewTab,
    registerFrame: registerFrame,
    unregisterFrame: unregisterFrame,
    frameFocused: handleFrameFocused,
    nextFrame: function(request, tab) {
      BackgroundCommands.nextFrame(tab, 1, request.frameId);
    },
    initVomnibar: function() {
      //*
      return filesContent.vomnibar;
      /*/
      return fetchFileContents("pages/vomnibar.html");
      //*/
    },
    upgradeNotificationClosed: upgradeNotificationClosed,
    copyToClipboard: copyToClipboard,
    isEnabledForUrl: isEnabledForUrl,
    saveHelpDialogSettings: saveHelpDialogSettings,
    selectSpecificTab: selectSpecificTab,
    refreshCompleter: refreshCompleter,
    createMark: Marks.create.bind(Marks),
    gotoMark: Marks.goTo.bind(Marks)
  };

  Commands.clearKeyMappingsAndSetDefaults();

  if (Settings.has("keyMappings")) {
    Commands.parseCustomKeyMappings(Settings.get("keyMappings"));
  }

  populateKeyCommands();

  if (shouldShowUpgradeMessage()) {
    sendRequestToAllTabs({
      name: "showUpgradeNotification",
      version: currentVersion
    });
  }

  chrome.windows.getAll({
    populate: true
  }, function(wnds) {
    var tab, _i, _len, _j, _len1, _ref, handleUpdateScrollPosition = function(request) {
      var ref;
      if (request && (ref = tabInfoMap[request.tabId])) {
        ref.scrollX = request.scrollX;
        ref.scrollY = request.scrollY;
        }
      };
    for (_i = 0, _len = wnds.length; _i < _len; _i++) {
      _ref = wnds[_i].tabs;
      for (_j = 0, _len1 = _ref.length; _j < _len1; _j++) {
        tab = _ref[_j];
        updateOpenTabs(tab);
        chrome.tabs.sendMessage(tab.id, {
          name: "getScrollPosition",
          tabId: tab.id
        }, handleUpdateScrollPosition);
      }
    }
  });

  filesContent.vomnibar = fetchFileContents("pages/vomnibar.html");

  showActionIcon = false;
  setShowActionIcon(Settings.get("showActionIcon"));
  
  // Sync.init();

})();
