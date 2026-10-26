const { contextBridge } = require('electron');

/* 给网页层暴露一层壳信息；后续「接管其他播放器」的能力也挂在这里 */
contextBridge.exposeInMainWorld('TideShell', {
  platform: process.platform,
  desktop: true,
  version: process.versions.electron,
});
