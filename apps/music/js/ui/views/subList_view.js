/* exported SubListView */
/* global AlbumArtCache, createListElement, Database, LazyLoader, ModeManager,
          MODE_PLAYER, PlaybackQueue, PlayerView, showImage, TabBar */
'use strict';

var SubListView = {
  get view() {
    return document.getElementById('views-sublist');
  },

  get dataSource() {
    return this._dataSource;
  },

  get anchor() {
    return document.getElementById('views-sublist-anchor');
  },

  set dataSource(source) {
    this._dataSource = source;

    // At the same time we also check how many songs in an album
    // Shuffle button is not necessary when an album only contains one song
    this.shuffleButton.disabled = (this._dataSource.length < 2);
  },

  init: function slv_init() {
    this.albumImage = document.getElementById('views-sublist-header-image');
    this.albumName = document.getElementById('views-sublist-header-name');
    this.playAllButton = document.getElementById('views-sublist-controls-play');
    this.shuffleButton =
      document.getElementById('views-sublist-controls-shuffle');

    this.handle = null;
    this.dataSource = [];
    this.index = 0;

    this.view.addEventListener('click', this);
  },

  clean: function slv_clean() {
    // Cancel a pending enumeration before start a new one
    if (this.handle) {
      Database.cancelEnumeration(this.handle);
    }

    this.dataSource = [];
    this.index = 0;
    this.anchor.innerHTML = '';
    this.view.scrollTop = 0;
  },

  setAlbumSrc: function slv_setAlbumSrc(fileinfo) {
    // See if we are viewing the predefined playlists, if so, then replace the
    // fileinfo with the first record in the dataSource to display the first
    // album art for every predefined playlist.
    if (TabBar.playlistArray.indexOf(fileinfo) !== -1) {
      fileinfo = this.dataSource[0];
    }

    LazyLoader.load('js/metadata/album_art_cache.js').then(() => {
      return AlbumArtCache.getThumbnailURL(fileinfo);
    }).then((url) => {
      showImage(this.albumImage, url);
    });
  },

  setAlbumName: function slv_setAlbumName(name, l10nId) {
    this.albumName.textContent = name;
    this.albumName.dataset.l10nId = l10nId;
  },

  activate: function(option, data, index, keyRange, direction, callback) {
    var targetOption = (option === 'date') ? option : 'metadata.' + option;
    this.clean();

    this.handle = Database.enumerateAll(targetOption, keyRange, direction,
                                        function lv_enumerateAll(dataArray) {
      var albumName;
      var albumNameL10nId;
      var maxDiscNum = 1;

      if (option === 'album') {
        dataArray.sort(function(e1, e2) {
          return (e1.metadata.discnum - e2.metadata.discnum) ||
            (e1.metadata.tracknum - e2.metadata.tracknum);
        });

        maxDiscNum = Math.max(
          dataArray[dataArray.length - 1].metadata.disccount,
          dataArray[dataArray.length - 1].metadata.discnum
        );
      }

      if (option === 'artist') {
        albumName =
          data.metadata.artist || navigator.mozL10n.get('unknownArtist');
        albumNameL10nId = data.metadata.artist ? '' : 'unknownArtist';
      } else if (option === 'album') {
        albumName =
          data.metadata.album || navigator.mozL10n.get('unknownAlbum');
        albumNameL10nId = data.metadata.album ? '' : 'unknownAlbum';
      } else {
        albumName =
          data.metadata.title || navigator.mozL10n.get('unknownTitle');
        albumNameL10nId = data.metadata.title ? '' : 'unknownTitle';
      }

      // Overrides l10nId.
      if (data.metadata.l10nId) {
        albumNameL10nId = data.metadata.l10nId;
      }

      this.dataSource = dataArray;
      this.setAlbumName(albumName, albumNameL10nId);
      this.setAlbumSrc(data);

      var inPlaylist = (option !== 'artist' &&
                        option !== 'album' &&
                        option !== 'title');

      dataArray.forEach(function(songData) {
        songData.multidisc = (maxDiscNum > 1);
        this.update(songData, inPlaylist);
      }.bind(this));

      if (callback) {
        callback();
      }
    }.bind(this));
  },

  // Set inPlaylist to true if you want the index instead of the track #
  // By default it is the track #
  update: function slv_update(result, useIndexNumber) {
    if (result === null) {
      return;
    }

    var option = useIndexNumber ? 'song-index' : 'song';
    this.anchor.appendChild(createListElement(option, result, this.index));

    this.index++;
  },

  handleEvent: function slv_handleEvent(evt) {
    var target = evt.target;

    if (!target) {
      return;
    }

    switch (evt.type) {
      case 'click':
        if (target === this.shuffleButton || target === this.playAllButton) {
          ModeManager.push(MODE_PLAYER, () => {
            PlayerView.clean();
            PlaybackQueue.shuffle = (target === this.shuffleButton);
            PlayerView.activate(new PlaybackQueue.StaticQueue(this.dataSource));
            PlayerView.start();
          });
        } else if (target.dataset.index) {
          ModeManager.push(MODE_PLAYER, () => {
            PlayerView.clean();
            var targetIndex = parseInt(target.dataset.index, 10);
            PlayerView.activate(new PlaybackQueue.StaticQueue(
              this.dataSource, targetIndex
            ));
            PlayerView.start();
          });
        }
        break;

      default:
        return;
    }
  }
};
