/* eslint-disable */
// Trimmed Phaser for the game build (vite.config.ts aliases `phaser` here;
// TypeScript still uses Phaser's own types). Based on Phaser's
// src/phaser-core.js, with only the parts this game uses, so phones download
// and parse much less before the first screen. Build flags (WebGL only,
// sound on) are set by the phaserFlags plugin in vite.config.ts.
//
// Left out: Arcade and Matter physics, tilemaps, particles, video, DOM
// elements, canvas Text, lights, the unused game objects (Blitter, Rope,
// RenderTexture, TileSprite, Shader, PointLight, Zone, Extern, Layer),
// gamepad input and the Canvas renderer. Kept for later: sound (and audio
// loading), tweens, timers.
//
// To bring a feature back, require it below (and its Factory, so
// `this.add.<name>` exists), e.g. particles:
//   ParticleEmitter: require('phaser/src/gameobjects/particles/ParticleEmitter'),
//   Factories: { Particles: require('phaser/src/gameobjects/particles/ParticleEmitterFactory') }

require('phaser/src/polyfills/requestVideoFrame');

var CONST = require('phaser/src/const');
var Extend = require('phaser/src/utils/object/Extend');

var InputConst = require('phaser/src/input/const');
var Input = Extend(
  false,
  {
    CreatePixelPerfectHandler: require('phaser/src/input/CreatePixelPerfectHandler'),
    CreateInteractiveObject: require('phaser/src/input/CreateInteractiveObject'),
    Events: require('phaser/src/input/events'),
    InputManager: require('phaser/src/input/InputManager'),
    InputPlugin: require('phaser/src/input/InputPlugin'),
    InputPluginCache: require('phaser/src/input/InputPluginCache'),
    Keyboard: require('phaser/src/input/keyboard'),
    Mouse: require('phaser/src/input/mouse'),
    Pointer: require('phaser/src/input/Pointer'),
    Touch: require('phaser/src/input/touch'),
  },
  InputConst
);

var Phaser = {
  Animations: require('phaser/src/animations'),
  BlendModes: require('phaser/src/renderer/BlendModes'),
  Cache: require('phaser/src/cache'),
  Cameras: { Scene2D: require('phaser/src/cameras/2d') },
  Core: require('phaser/src/core'),
  Class: require('phaser/src/utils/Class'),
  Data: require('phaser/src/data'),
  Display: { Masks: require('phaser/src/display/mask') },
  DOM: require('phaser/src/dom'),
  Events: require('phaser/src/events'),
  FX: require('phaser/src/fx'),
  Game: require('phaser/src/core/Game'),
  GameObjects: {
    DisplayList: require('phaser/src/gameobjects/DisplayList'),
    GameObjectCreator: require('phaser/src/gameobjects/GameObjectCreator'),
    GameObjectFactory: require('phaser/src/gameobjects/GameObjectFactory'),
    UpdateList: require('phaser/src/gameobjects/UpdateList'),
    Components: require('phaser/src/gameobjects/components'),
    BuildGameObject: require('phaser/src/gameobjects/BuildGameObject'),
    BuildGameObjectAnimation: require('phaser/src/gameobjects/BuildGameObjectAnimation'),
    GameObject: require('phaser/src/gameobjects/GameObject'),
    BitmapText: require('phaser/src/gameobjects/bitmaptext/static/BitmapText'),
    Container: require('phaser/src/gameobjects/container/Container'),
    Graphics: require('phaser/src/gameobjects/graphics/Graphics'),
    Image: require('phaser/src/gameobjects/image/Image'),
    Mesh: require('phaser/src/gameobjects/mesh/Mesh'),
    Rectangle: require('phaser/src/gameobjects/shape/rectangle/Rectangle'),
    RetroFont: require('phaser/src/gameobjects/bitmaptext/RetroFont'),
    Sprite: require('phaser/src/gameobjects/sprite/Sprite'),
    Factories: {
      BitmapText: require('phaser/src/gameobjects/bitmaptext/static/BitmapTextFactory'),
      Container: require('phaser/src/gameobjects/container/ContainerFactory'),
      Graphics: require('phaser/src/gameobjects/graphics/GraphicsFactory'),
      Image: require('phaser/src/gameobjects/image/ImageFactory'),
      Mesh: require('phaser/src/gameobjects/mesh/MeshFactory'),
      Rectangle: require('phaser/src/gameobjects/shape/rectangle/RectangleFactory'),
      Sprite: require('phaser/src/gameobjects/sprite/SpriteFactory'),
    },
  },
  Input: Input,
  Loader: {
    Events: require('phaser/src/loader/events'),
    FileTypes: {
      AnimationJSONFile: require('phaser/src/loader/filetypes/AnimationJSONFile'),
      AtlasJSONFile: require('phaser/src/loader/filetypes/AtlasJSONFile'),
      AudioFile: require('phaser/src/loader/filetypes/AudioFile'),
      AudioSpriteFile: require('phaser/src/loader/filetypes/AudioSpriteFile'),
      HTML5AudioFile: require('phaser/src/loader/filetypes/HTML5AudioFile'),
      ImageFile: require('phaser/src/loader/filetypes/ImageFile'),
      JSONFile: require('phaser/src/loader/filetypes/JSONFile'),
      MultiAtlasFile: require('phaser/src/loader/filetypes/MultiAtlasFile'),
      SpriteSheetFile: require('phaser/src/loader/filetypes/SpriteSheetFile'),
      TextFile: require('phaser/src/loader/filetypes/TextFile'),
    },
    File: require('phaser/src/loader/File'),
    FileTypesManager: require('phaser/src/loader/FileTypesManager'),
    GetURL: require('phaser/src/loader/GetURL'),
    LoaderPlugin: require('phaser/src/loader/LoaderPlugin'),
    MergeXHRSettings: require('phaser/src/loader/MergeXHRSettings'),
    MultiFile: require('phaser/src/loader/MultiFile'),
    XHRLoader: require('phaser/src/loader/XHRLoader'),
    XHRSettings: require('phaser/src/loader/XHRSettings'),
  },
  Math: {
    Between: require('phaser/src/math/Between'),
    Clamp: require('phaser/src/math/Clamp'),
    DegToRad: require('phaser/src/math/DegToRad'),
    FloatBetween: require('phaser/src/math/FloatBetween'),
    RadToDeg: require('phaser/src/math/RadToDeg'),
    Vector2: require('phaser/src/math/Vector2'),
  },
  Plugins: require('phaser/src/plugins'),
  Renderer: require('phaser/src/renderer'),
  Scale: require('phaser/src/scale'),
  ScaleModes: require('phaser/src/renderer/ScaleModes'),
  Scene: require('phaser/src/scene/Scene'),
  Scenes: require('phaser/src/scene'),
  Sound: require('phaser/src/sound'),
  Structs: require('phaser/src/structs'),
  Textures: require('phaser/src/textures'),
  Time: require('phaser/src/time'),
  Tweens: require('phaser/src/tweens'),
};

module.exports = Extend(false, Phaser, CONST);
