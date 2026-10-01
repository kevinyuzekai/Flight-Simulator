/* ==========================================================================
   天际航线 SkyRoute — 全球机场 / 跑道 / ILS 数据库
   --------------------------------------------------------------------------
   坐标基准: WGS84 十进制度;  世界坐标约定 X=东(+) Z=南(+) Y=上, 单位米
   数据说明:
     · 机场基准点经纬度/标高、跑道端经纬度、跑道长宽、道面、真向 取自
       OurAirports 公共领域数据集(airports.csv / runways.csv), 并经公开资料校对;
     · 磁差 magVar 取自同数据集 navaids.csv 中机场最近导航台的实测磁差(东正西负),
       已四舍五入到 0.1°;
     · 跑道真向 hdgTrue: 当两端坐标推算的大圆方位角与「编号×10 + 磁差」相差 ≤5.5°
       时取该坐标方位角(最可靠); 否则取数据集给出的真向; 再否则由编号+磁差推算,
       以保证同一跑道两端严格互反、且 hdgMag 与跑道编号自洽;
     · hdgMag = wrap360(hdgTrue - magVar), 即磁航向;
     · 过渡高度 transitionAltFt: 中国/日本/美国等取当地公布值, 其余为当地常用值;
     · ILS: 频率/识别码/等级以公开航图资料为准, 个别次要跑道为合理推定;
       课程角 course = 该跑道端真向, 下滑角统一 3.00°, DME 波道由频率按
       ICAO 配对规则(108.0MHz=17X, 每 0.05MHz 递进)算出;
     · 跑道端坐标绝大多数为数据集实测值; 若某跑道两端实测坐标与该跑道公布长度
       或选定真向不自洽(端点坐标偏粗), 则以跑道中点为锚、按公布长度与真向对称重排
       两端(共 69 条), 使同一跑道两端严格互反且间距等于公布长度;
     · 仅 1 条跑道端由相邻平行跑道平移推算(数据集中无任何坐标);
     · 原始数据集中的在建跑道/水上跑道/场内草道已剔除(见源码 DROP 表).
   统计: 77 个机场 / 462 条跑道端 / 416 套 ILS.
   ========================================================================== */
(function (global) {
  'use strict';
  var FS = global.FS = global.FS || {};
  var U = FS.Utils;

  if (!U || !FS.Geo || !FS.Log) {
    if (global.console) console.error('airports.js: 需要先加载 utils.js');
    return;
  }

  /* ========================================================================
     机场数据 (按地区分组)
     ======================================================================== */
  FS.AIRPORTS = [
    /* ------------------------- 中国 China ------------------------- */
    {
      icao: 'ZSPD', iata: 'PVG',
      name: 'Shanghai Pudong International Airport', nameZh: '上海浦东国际机场',
      city: 'Shanghai', cityZh: '上海', country: 'China', countryZh: '中国',
      region: 'china', lat: 31.14340, lon: 121.80500, elevFt: 13, magVar: -5.2, tz: 8,
      transitionAltFt: 9800, size: 'large',
      runways: [
        { ident: '16L', paired: '34R', hdgTrue: 154.8, hdgMag: 160.0, lengthFt: 12467, widthFt: 197, lat: 31.15934, lon: 121.81381, elevFt: 11, surface: 'concrete', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 110.30, ident: 'IPD', course: 154.8, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '34R', paired: '16L', hdgTrue: 334.8, hdgMag: 340.0, lengthFt: 12467, widthFt: 197, lat: 31.12841, lon: 121.83081, elevFt: 11, surface: 'concrete', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 109.10, ident: 'IPC', course: 334.8, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH28X' } },
        { ident: '16R', paired: '34L', hdgTrue: 154.8, hdgMag: 160.0, lengthFt: 12467, widthFt: 197, lat: 31.15816, lon: 121.80950, elevFt: 12, surface: 'concrete', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 110.90, ident: 'IPA', course: 154.8, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH46X' } },
        { ident: '34L', paired: '16R', hdgTrue: 334.8, hdgMag: 340.0, lengthFt: 12467, widthFt: 197, lat: 31.12724, lon: 121.82650, elevFt: 12, surface: 'concrete', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 111.10, ident: 'IPB', course: 334.8, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH48X' } },
        { ident: '17L', paired: '35R', hdgTrue: 162.0, hdgMag: 167.2, lengthFt: 13123, widthFt: 197, lat: 31.16130, lon: 121.78600, elevFt: 10, surface: 'concrete', toraFt: 13123, ldaFt: 13123,
          ils: { freq: 108.90, ident: 'IPF', course: 162.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '35R', paired: '17L', hdgTrue: 342.0, hdgMag: 347.2, lengthFt: 13123, widthFt: 197, lat: 31.12700, lon: 121.79900, elevFt: 10, surface: 'concrete', toraFt: 13123, ldaFt: 13123,
          ils: null },
        { ident: '17R', paired: '35L', hdgTrue: 162.1, hdgMag: 167.3, lengthFt: 11154, widthFt: 197, lat: 31.15483, lon: 121.78316, elevFt: 12, surface: 'concrete', toraFt: 11154, ldaFt: 11154,
          ils: { freq: 109.90, ident: 'IPG', course: 162.1, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH36X' } },
        { ident: '35L', paired: '17R', hdgTrue: 342.1, hdgMag: 347.3, lengthFt: 11154, widthFt: 197, lat: 31.12567, lon: 121.79417, elevFt: 12, surface: 'concrete', toraFt: 11154, ldaFt: 11154,
          ils: null }
      ]
    },
    {
      icao: 'ZBAA', iata: 'PEK',
      name: 'Beijing Capital International Airport', nameZh: '北京首都国际机场',
      city: 'Beijing', cityZh: '北京', country: 'China', countryZh: '中国',
      region: 'china', lat: 40.07735, lon: 116.59670, elevFt: 116, magVar: -6.2, tz: 8,
      transitionAltFt: 9800, size: 'large',
      runways: [
        { ident: '01', paired: '19', hdgTrue: 3.8, hdgMag: 10.0, lengthFt: 12467, widthFt: 197, lat: 40.05882, lon: 116.61347, elevFt: 94, surface: 'concrete', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 108.90, ident: 'IBA', course: 3.8, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '19', paired: '01', hdgTrue: 183.8, hdgMag: 190.0, lengthFt: 12467, widthFt: 197, lat: 40.09292, lon: 116.61643, elevFt: 84, surface: 'concrete', toraFt: 12467, ldaFt: 12467,
          ils: null },
        { ident: '18L', paired: '36R', hdgTrue: 173.1, hdgMag: 179.3, lengthFt: 12467, widthFt: 197, lat: 40.08936, lon: 116.59483, elevFt: 110, surface: 'asphalt', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 110.30, ident: 'IBL', course: 173.1, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '36R', paired: '18L', hdgTrue: 353.1, hdgMag: 359.3, lengthFt: 12467, widthFt: 197, lat: 40.05553, lon: 116.60017, elevFt: 99, surface: 'asphalt', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 109.30, ident: 'IBR', course: 353.1, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH30X' } },
        { ident: '18R', paired: '36L', hdgTrue: 173.2, hdgMag: 179.4, lengthFt: 10499, widthFt: 164, lat: 40.10211, lon: 116.56970, elevFt: 116, surface: 'concrete', toraFt: 10499, ldaFt: 10499,
          ils: { freq: 111.10, ident: 'IBN', course: 173.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH48X' } },
        { ident: '36L', paired: '18R', hdgTrue: 353.2, hdgMag: 359.4, lengthFt: 10499, widthFt: 164, lat: 40.07348, lon: 116.57417, elevFt: 107, surface: 'concrete', toraFt: 10499, ldaFt: 10499,
          ils: { freq: 110.70, ident: 'IBM', course: 353.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } }
      ]
    },
    {
      icao: 'ZBAD', iata: 'PKX',
      name: 'Beijing Daxing International Airport', nameZh: '北京大兴国际机场',
      city: 'Beijing', cityZh: '北京', country: 'China', countryZh: '中国',
      region: 'china', lat: 39.50129, lon: 116.41397, elevFt: 98, magVar: -6.1, tz: 8,
      transitionAltFt: 9800, size: 'large',
      runways: [
        { ident: '01L', paired: '19R', hdgTrue: 3.9, hdgMag: 10.0, lengthFt: 11155, widthFt: 197, lat: 39.47125, lon: 116.42765, elevFt: 73, surface: 'concrete', toraFt: 11155, ldaFt: 11155,
          ils: { freq: 109.90, ident: 'IDU', course: 3.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH36X' } },
        { ident: '19R', paired: '01L', hdgTrue: 183.9, hdgMag: 190.0, lengthFt: 11155, widthFt: 197, lat: 39.50175, lon: 116.43035, elevFt: 83, surface: 'concrete', toraFt: 11155, ldaFt: 11155,
          ils: null },
        { ident: '11L', paired: '29R', hdgTrue: 103.2, hdgMag: 109.3, lengthFt: 12467, widthFt: 197, lat: 39.51670, lon: 116.43100, elevFt: 69, surface: 'concrete', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 108.90, ident: 'IDV', course: 103.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '29R', paired: '11L', hdgTrue: 283.2, hdgMag: 289.3, lengthFt: 12467, widthFt: 197, lat: 39.50890, lon: 116.47400, elevFt: 69, surface: 'concrete', toraFt: 12467, ldaFt: 12467,
          ils: null },
        { ident: '17L', paired: '35R', hdgTrue: 163.9, hdgMag: 170.0, lengthFt: 12467, widthFt: 197, lat: 39.51733, lon: 116.39265, elevFt: 76, surface: 'concrete', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 110.30, ident: 'IDX', course: 163.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '35R', paired: '17L', hdgTrue: 343.9, hdgMag: 350.0, lengthFt: 12467, widthFt: 197, lat: 39.48450, lon: 116.40493, elevFt: 76, surface: 'concrete', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 109.30, ident: 'IDY', course: 343.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH30X' } },
        { ident: '17R', paired: '35L', hdgTrue: 163.9, hdgMag: 170.0, lengthFt: 12467, widthFt: 148, lat: 39.51650, lon: 116.38388, elevFt: 76, surface: 'concrete', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 111.10, ident: 'IDZ', course: 163.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH48X' } },
        { ident: '35L', paired: '17R', hdgTrue: 343.9, hdgMag: 350.0, lengthFt: 12467, widthFt: 148, lat: 39.48367, lon: 116.39616, elevFt: 76, surface: 'concrete', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 110.70, ident: 'IDW', course: 343.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } }
      ]
    },
    {
      icao: 'ZGGG', iata: 'CAN',
      name: 'Guangzhou Baiyun International Airport', nameZh: '广州白云国际机场',
      city: 'Guangzhou', cityZh: '广州', country: 'China', countryZh: '中国',
      region: 'china', lat: 23.39240, lon: 113.29900, elevFt: 50, magVar: -2.2, tz: 8,
      transitionAltFt: 9800, size: 'large',
      runways: [
        { ident: '01L', paired: '19R', hdgTrue: 7.8, hdgMag: 10.0, lengthFt: 11155, widthFt: 148, lat: 23.38044, lon: 113.27705, elevFt: 43, surface: 'concrete', toraFt: 11155, ldaFt: 11155,
          ils: { freq: 111.70, ident: 'IGX', course: 7.8, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH54X' } },
        { ident: '19R', paired: '01L', hdgTrue: 187.8, hdgMag: 190.0, lengthFt: 11155, widthFt: 148, lat: 23.41073, lon: 113.28157, elevFt: 43, surface: 'concrete', toraFt: 11155, ldaFt: 11155,
          ils: null },
        { ident: '01R', paired: '19L', hdgTrue: 13.0, hdgMag: 15.2, lengthFt: 11811, widthFt: 148, lat: 23.37680, lon: 113.28400, elevFt: 41, surface: 'concrete', toraFt: 11811, ldaFt: 11811,
          ils: { freq: 108.90, ident: 'IGU', course: 13.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '19L', paired: '01R', hdgTrue: 193.0, hdgMag: 195.2, lengthFt: 11811, widthFt: 148, lat: 23.40841, lon: 113.29195, elevFt: 43, surface: 'concrete', toraFt: 11811, ldaFt: 11811,
          ils: null },
        { ident: '02L', paired: '20R', hdgTrue: 14.0, hdgMag: 16.2, lengthFt: 12467, widthFt: 197, lat: 23.37570, lon: 113.30500, elevFt: 45, surface: 'asphalt', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 110.30, ident: 'IGG', course: 14.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '20R', paired: '02L', hdgTrue: 194.0, hdgMag: 196.2, lengthFt: 12467, widthFt: 197, lat: 23.40890, lon: 113.31400, elevFt: 45, surface: 'asphalt', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 109.30, ident: 'IGR', course: 194.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH30X' } },
        { ident: '02R', paired: '20L', hdgTrue: 13.9, hdgMag: 16.1, lengthFt: 12467, widthFt: 197, lat: 23.36950, lon: 113.30800, elevFt: 45, surface: 'concrete', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 111.10, ident: 'IGS', course: 13.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH48X' } },
        { ident: '20L', paired: '02R', hdgTrue: 193.9, hdgMag: 196.1, lengthFt: 12467, widthFt: 197, lat: 23.40280, lon: 113.31700, elevFt: 48, surface: 'concrete', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 110.70, ident: 'IGT', course: 193.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } },
        { ident: '03', paired: '21', hdgTrue: 27.8, hdgMag: 30.0, lengthFt: 11811, widthFt: 148, lat: 23.35623, lon: 113.31518, elevFt: 48, surface: 'concrete', toraFt: 11811, ldaFt: 11811,
          ils: { freq: 109.90, ident: 'IGV', course: 27.8, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH36X' } },
        { ident: '21', paired: '03', hdgTrue: 207.8, hdgMag: 210.0, lengthFt: 11811, widthFt: 148, lat: 23.38487, lon: 113.33163, elevFt: 48, surface: 'concrete', toraFt: 11811, ldaFt: 11811,
          ils: null }
      ]
    },
    {
      icao: 'ZUUU', iata: 'CTU',
      name: 'Chengdu Shuangliu International Airport', nameZh: '成都双流国际机场',
      city: 'Chengdu', cityZh: '成都', country: 'China', countryZh: '中国',
      region: 'china', lat: 30.55826, lon: 103.94597, elevFt: 1625, magVar: -1.4, tz: 8,
      transitionAltFt: 9800, size: 'large',
      runways: [
        { ident: '02L', paired: '20R', hdgTrue: 21.8, hdgMag: 23.2, lengthFt: 11811, widthFt: 148, lat: 30.56346, lon: 103.93999, elevFt: 1616, surface: 'asphalt', toraFt: 11811, ldaFt: 11811,
          ils: { freq: 110.30, ident: 'ICU', course: 21.8, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '20R', paired: '02L', hdgTrue: 201.8, hdgMag: 203.2, lengthFt: 11811, widthFt: 148, lat: 30.59360, lon: 103.95400, elevFt: 1625, surface: 'asphalt', toraFt: 11811, ldaFt: 11811,
          ils: { freq: 109.30, ident: 'ICV', course: 201.8, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH30X' } },
        { ident: '02R', paired: '20L', hdgTrue: 21.4, hdgMag: 22.8, lengthFt: 11811, widthFt: 197, lat: 30.51950, lon: 103.93700, elevFt: 1681, surface: 'concrete', toraFt: 11811, ldaFt: 11811,
          ils: { freq: 111.10, ident: 'ICW', course: 21.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH48X' } },
        { ident: '20L', paired: '02R', hdgTrue: 201.4, hdgMag: 202.8, lengthFt: 11811, widthFt: 197, lat: 30.54960, lon: 103.95068, elevFt: 1629, surface: 'concrete', toraFt: 11811, ldaFt: 11811,
          ils: { freq: 110.70, ident: 'ICX', course: 201.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } }
      ]
    },
    {
      icao: 'ZUTF', iata: 'TFU',
      name: 'Chengdu Tianfu International Airport', nameZh: '成都天府国际机场',
      city: 'Chengdu', cityZh: '成都', country: 'China', countryZh: '中国',
      region: 'china', lat: 30.31252, lon: 104.44128, elevFt: 1440, magVar: -1.5, tz: 8,
      transitionAltFt: 9800, size: 'large',
      runways: [
        { ident: '01', paired: '19', hdgTrue: 8.5, hdgMag: 10.0, lengthFt: 13123, widthFt: 197, lat: 30.28934, lon: 104.42229, elevFt: 1441, surface: 'concrete', toraFt: 13123, ldaFt: 13123,
          ils: { freq: 110.30, ident: 'ITF', course: 8.5, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '19', paired: '01', hdgTrue: 188.5, hdgMag: 190.0, lengthFt: 13123, widthFt: 197, lat: 30.32491, lon: 104.42845, elevFt: 1441, surface: 'concrete', toraFt: 13123, ldaFt: 13123,
          ils: { freq: 109.30, ident: 'ITG', course: 188.5, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH30X' } },
        { ident: '02', paired: '20', hdgTrue: 22.1, hdgMag: 23.6, lengthFt: 10499, widthFt: 148, lat: 30.27764, lon: 104.43845, elevFt: 1448, surface: 'concrete', toraFt: 10499, ldaFt: 10499,
          ils: { freq: 111.10, ident: 'ITH', course: 22.1, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH48X' } },
        { ident: '20', paired: '02', hdgTrue: 202.1, hdgMag: 203.6, lengthFt: 10499, widthFt: 148, lat: 30.30436, lon: 104.45103, elevFt: 1448, surface: 'concrete', toraFt: 10499, ldaFt: 10499,
          ils: { freq: 110.70, ident: 'ITI', course: 202.1, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } },
        { ident: '11', paired: '29', hdgTrue: 112.2, hdgMag: 113.7, lengthFt: 12467, widthFt: 148, lat: 30.31510, lon: 104.45990, elevFt: 1434, surface: 'concrete', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 108.90, ident: 'ITJ', course: 112.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '29', paired: '11', hdgTrue: 292.2, hdgMag: 293.7, lengthFt: 12467, widthFt: 148, lat: 30.30220, lon: 104.49650, elevFt: 1434, surface: 'concrete', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 109.90, ident: 'ITK', course: 292.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH36X' } }
      ]
    },
    {
      icao: 'ZSSS', iata: 'SHA',
      name: 'Shanghai Hongqiao International Airport', nameZh: '上海虹桥国际机场',
      city: 'Shanghai', cityZh: '上海', country: 'China', countryZh: '中国',
      region: 'china', lat: 31.19810, lon: 121.33426, elevFt: 10, magVar: -5.1, tz: 8,
      transitionAltFt: 9800, size: 'large',
      runways: [
        { ident: '18L', paired: '36R', hdgTrue: 176.8, hdgMag: 181.9, lengthFt: 11154, widthFt: 148, lat: 31.21320, lon: 121.33500, elevFt: 7, surface: 'asphalt', toraFt: 11154, ldaFt: 11154,
          ils: { freq: 110.30, ident: 'ISH', course: 176.8, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '36R', paired: '18L', hdgTrue: 356.8, hdgMag: 1.9, lengthFt: 11154, widthFt: 148, lat: 31.18250, lon: 121.33700, elevFt: 9, surface: 'asphalt', toraFt: 11154, ldaFt: 11154,
          ils: { freq: 109.30, ident: 'ISI', course: 356.8, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } },
        { ident: '18R', paired: '36L', hdgTrue: 178.0, hdgMag: 183.1, lengthFt: 10826, widthFt: 197, lat: 31.21283, lon: 121.33188, elevFt: 10, surface: 'concrete', toraFt: 10826, ldaFt: 10826,
          ils: { freq: 111.10, ident: 'ISJ', course: 178.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '36L', paired: '18R', hdgTrue: 358.0, hdgMag: 3.1, lengthFt: 10826, widthFt: 197, lat: 31.18317, lon: 121.33312, elevFt: 10, surface: 'concrete', toraFt: 10826, ldaFt: 10826,
          ils: { freq: 110.70, ident: 'ISK', course: 358.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } }
      ]
    },
    {
      icao: 'ZGSZ', iata: 'SZX',
      name: 'Shenzhen Bao\'an International Airport', nameZh: '深圳宝安国际机场',
      city: 'Shenzhen', cityZh: '深圳', country: 'China', countryZh: '中国',
      region: 'china', lat: 22.63947, lon: 113.80326, elevFt: 13, magVar: -2.2, tz: 8,
      transitionAltFt: 9800, size: 'large',
      runways: [
        { ident: '15', paired: '33', hdgTrue: 153.2, hdgMag: 155.4, lengthFt: 11155, widthFt: 148, lat: 22.65300, lon: 113.80300, elevFt: 13, surface: 'concrete', toraFt: 11155, ldaFt: 11155,
          ils: { freq: 111.10, ident: 'ISX', course: 153.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '33', paired: '15', hdgTrue: 333.2, hdgMag: 335.4, lengthFt: 11155, widthFt: 148, lat: 22.62560, lon: 113.81800, elevFt: 13, surface: 'concrete', toraFt: 11155, ldaFt: 11155,
          ils: { freq: 110.70, ident: 'ISW', course: 333.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } },
        { ident: '16L', paired: '34R', hdgTrue: 153.2, hdgMag: 155.4, lengthFt: 12467, widthFt: 197, lat: 22.65446, lon: 113.78485, elevFt: 4, surface: 'concrete', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 110.30, ident: 'ISZ', course: 153.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '34R', paired: '16L', hdgTrue: 333.2, hdgMag: 335.4, lengthFt: 12467, widthFt: 197, lat: 22.62388, lon: 113.80162, elevFt: 4, surface: 'concrete', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 109.30, ident: 'ISY', course: 333.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } },
        { ident: '16R', paired: '34L', hdgTrue: 153.2, hdgMag: 155.4, lengthFt: 11811, widthFt: 148, lat: 22.65906, lon: 113.77634, elevFt: 13, surface: 'concrete', toraFt: 11811, ldaFt: 11811,
          ils: { freq: 108.90, ident: 'ISV', course: 153.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '34L', paired: '16R', hdgTrue: 333.2, hdgMag: 335.4, lengthFt: 11811, widthFt: 148, lat: 22.63008, lon: 113.79222, elevFt: 13, surface: 'concrete', toraFt: 11811, ldaFt: 11811,
          ils: null }
      ]
    },
    {
      icao: 'ZPPP', iata: 'KMG',
      name: 'Kunming Changshui International Airport', nameZh: '昆明长水国际机场',
      city: 'Kunming', cityZh: '昆明', country: 'China', countryZh: '中国',
      region: 'china', lat: 25.11031, lon: 102.93674, elevFt: 6903, magVar: -1.1, tz: 8,
      transitionAltFt: 11800, size: 'large',
      runways: [
        { ident: '03', paired: '21', hdgTrue: 28.9, hdgMag: 30.0, lengthFt: 13123, widthFt: 148, lat: 25.10062, lon: 102.91970, elevFt: 6891, surface: 'concrete', toraFt: 13123, ldaFt: 13123,
          ils: { freq: 110.30, ident: 'IKM', course: 28.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '21', paired: '03', hdgTrue: 208.9, hdgMag: 210.0, lengthFt: 13123, widthFt: 148, lat: 25.13211, lon: 102.93890, elevFt: 6884, surface: 'concrete', toraFt: 13123, ldaFt: 13123,
          ils: { freq: 109.30, ident: 'IKN', course: 208.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } },
        { ident: '04', paired: '22', hdgTrue: 38.2, hdgMag: 39.3, lengthFt: 14764, widthFt: 197, lat: 25.08969, lon: 102.93075, elevFt: 6885, surface: 'asphalt', toraFt: 14764, ldaFt: 14764,
          ils: { freq: 111.10, ident: 'IKO', course: 38.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '22', paired: '04', hdgTrue: 218.2, hdgMag: 219.3, lengthFt: 14764, widthFt: 197, lat: 25.12149, lon: 102.95840, elevFt: 6879, surface: 'asphalt', toraFt: 14764, ldaFt: 14764,
          ils: { freq: 110.70, ident: 'IKP', course: 218.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } }
      ]
    },
    {
      icao: 'ZLXY', iata: 'XIY',
      name: 'Xi\'an Xianyang International Airport', nameZh: '西安咸阳国际机场',
      city: 'Xi\'an', cityZh: '西安', country: 'China', countryZh: '中国',
      region: 'china', lat: 34.44221, lon: 108.76238, elevFt: 1572, magVar: -3.1, tz: 8,
      transitionAltFt: 9800, size: 'large',
      runways: [
        { ident: '05L', paired: '23R', hdgTrue: 48.7, hdgMag: 51.8, lengthFt: 12467, widthFt: 148, lat: 34.44215, lon: 108.73562, elevFt: 1574, surface: 'asphalt', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 110.30, ident: 'IXY', course: 48.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '23R', paired: '05L', hdgTrue: 228.7, hdgMag: 231.8, lengthFt: 12467, widthFt: 148, lat: 34.46470, lon: 108.76675, elevFt: 1578, surface: 'asphalt', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 109.30, ident: 'IXZ', course: 228.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } },
        { ident: '06L', paired: '24R', hdgTrue: 56.9, hdgMag: 60.0, lengthFt: 12467, widthFt: 197, lat: 34.42292, lon: 108.74926, elevFt: 1557, surface: 'concrete', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 111.10, ident: 'IXA', course: 56.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH48X' } },
        { ident: '24R', paired: '06L', hdgTrue: 236.9, hdgMag: 240.0, lengthFt: 12467, widthFt: 197, lat: 34.44159, lon: 108.78397, elevFt: 1578, surface: 'concrete', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 110.70, ident: 'IXB', course: 236.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } },
        { ident: '06R', paired: '24L', hdgTrue: 56.9, hdgMag: 60.0, lengthFt: 9843, widthFt: 148, lat: 34.42463, lon: 108.75895, elevFt: 1556, surface: 'concrete', toraFt: 9843, ldaFt: 9843,
          ils: { freq: 108.90, ident: 'IXC', course: 56.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '24L', paired: '06R', hdgTrue: 236.9, hdgMag: 240.0, lengthFt: 9843, widthFt: 148, lat: 34.43936, lon: 108.78635, elevFt: 1541, surface: 'concrete', toraFt: 9843, ldaFt: 9843,
          ils: null }
      ]
    },
    {
      icao: 'ZSHC', iata: 'HGH',
      name: 'Hangzhou Xiaoshan International Airport', nameZh: '杭州萧山国际机场',
      city: 'Hangzhou', cityZh: '杭州', country: 'China', countryZh: '中国',
      region: 'china', lat: 30.23609, lon: 120.42887, elevFt: 23, magVar: -4.5, tz: 8,
      transitionAltFt: 9800, size: 'large',
      runways: [
        { ident: '06', paired: '24', hdgTrue: 55.5, hdgMag: 60.0, lengthFt: 11155, widthFt: 197, lat: 30.23651, lon: 120.40944, elevFt: 22, surface: 'concrete', toraFt: 11155, ldaFt: 11155,
          ils: { freq: 111.10, ident: 'IHI', course: 55.5, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '24', paired: '06', hdgTrue: 235.5, hdgMag: 240.0, lengthFt: 11155, widthFt: 197, lat: 30.25382, lon: 120.43861, elevFt: 23, surface: 'concrete', toraFt: 11155, ldaFt: 11155,
          ils: null },
        { ident: '07', paired: '25', hdgTrue: 62.8, hdgMag: 67.3, lengthFt: 11811, widthFt: 148, lat: 30.22212, lon: 120.41776, elevFt: 22, surface: 'concrete', toraFt: 11811, ldaFt: 11811,
          ils: { freq: 110.30, ident: 'IHG', course: 62.8, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '25', paired: '07', hdgTrue: 242.8, hdgMag: 247.3, lengthFt: 11811, widthFt: 148, lat: 30.23689, lon: 120.45106, elevFt: 22, surface: 'concrete', toraFt: 11811, ldaFt: 11811,
          ils: { freq: 109.30, ident: 'IHH', course: 242.8, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } }
      ]
    },
    {
      icao: 'ZSNJ', iata: 'NKG',
      name: 'Nanjing Lukou International Airport', nameZh: '南京禄口国际机场',
      city: 'Nanjing', cityZh: '南京', country: 'China', countryZh: '中国',
      region: 'china', lat: 31.73503, lon: 118.86595, elevFt: 49, magVar: -4.6, tz: 8,
      transitionAltFt: 9800, size: 'large',
      runways: [
        { ident: '06', paired: '24', hdgTrue: 57.7, hdgMag: 62.3, lengthFt: 11811, widthFt: 148, lat: 31.73340, lon: 118.84600, elevFt: 43, surface: 'concrete', toraFt: 11811, ldaFt: 11811,
          ils: { freq: 111.10, ident: 'INL', course: 57.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '24', paired: '06', hdgTrue: 237.7, hdgMag: 242.3, lengthFt: 11811, widthFt: 148, lat: 31.75060, lon: 118.87800, elevFt: 38, surface: 'concrete', toraFt: 11811, ldaFt: 11811,
          ils: null },
        { ident: '07', paired: '25', hdgTrue: 65.4, hdgMag: 70.0, lengthFt: 11810, widthFt: 197, lat: 31.71537, lon: 118.84692, elevFt: 43, surface: 'concrete', toraFt: 11810, ldaFt: 11810,
          ils: { freq: 110.30, ident: 'INJ', course: 65.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH40X' } },
        { ident: '25', paired: '07', hdgTrue: 245.4, hdgMag: 250.0, lengthFt: 11810, widthFt: 197, lat: 31.72885, lon: 118.88152, elevFt: 39, surface: 'concrete', toraFt: 11810, ldaFt: 11810,
          ils: { freq: 109.30, ident: 'INK', course: 245.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } }
      ]
    },
    {
      icao: 'ZHHH', iata: 'WUH',
      name: 'Wuhan Tianhe International Airport', nameZh: '武汉天河国际机场',
      city: 'Wuhan', cityZh: '武汉', country: 'China', countryZh: '中国',
      region: 'china', lat: 30.77480, lon: 114.21372, elevFt: 113, magVar: -3.5, tz: 8,
      transitionAltFt: 9800, size: 'large',
      runways: [
        { ident: '04', paired: '22', hdgTrue: 42.0, hdgMag: 45.5, lengthFt: 11155, widthFt: 148, lat: 30.77230, lon: 114.19600, elevFt: 95, surface: 'asphalt', toraFt: 11155, ldaFt: 11155,
          ils: { freq: 111.10, ident: 'IWJ', course: 42.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '22', paired: '04', hdgTrue: 222.0, hdgMag: 225.5, lengthFt: 11155, widthFt: 148, lat: 30.79520, lon: 114.22000, elevFt: 112, surface: 'asphalt', toraFt: 11155, ldaFt: 11155,
          ils: { freq: 110.70, ident: 'IWK', course: 222.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } },
        { ident: '05L', paired: '23R', hdgTrue: 41.3, hdgMag: 44.8, lengthFt: 11811, widthFt: 197, lat: 30.75764, lon: 114.21079, elevFt: 97, surface: 'concrete', toraFt: 11811, ldaFt: 11811,
          ils: { freq: 110.30, ident: 'IWH', course: 41.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '23R', paired: '05L', hdgTrue: 221.3, hdgMag: 224.8, lengthFt: 11811, widthFt: 197, lat: 30.78197, lon: 114.23570, elevFt: 97, surface: 'concrete', toraFt: 11811, ldaFt: 11811,
          ils: { freq: 109.30, ident: 'IWI', course: 221.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } },
        { ident: '05R', paired: '23L', hdgTrue: 41.3, hdgMag: 44.8, lengthFt: 10498, widthFt: 148, lat: 30.75821, lon: 114.21639, elevFt: 97, surface: 'concrete', toraFt: 10498, ldaFt: 10498,
          ils: { freq: 108.90, ident: 'IWL', course: 41.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '23L', paired: '05R', hdgTrue: 221.3, hdgMag: 224.8, lengthFt: 10498, widthFt: 148, lat: 30.77984, lon: 114.23853, elevFt: 97, surface: 'concrete', toraFt: 10498, ldaFt: 10498,
          ils: null }
      ]
    },
    {
      icao: 'ZGHA', iata: 'CSX',
      name: 'Changsha Huanghua International Airport', nameZh: '长沙黄花国际机场',
      city: 'Changsha', cityZh: '长沙', country: 'China', countryZh: '中国',
      region: 'china', lat: 28.18920, lon: 113.22000, elevFt: 217, magVar: -3.1, tz: 8,
      transitionAltFt: 9800, size: 'large',
      runways: [
        { ident: '18L', paired: '36R', hdgTrue: 176.9, hdgMag: 180.0, lengthFt: 12467, widthFt: 197, lat: 28.20910, lon: 113.22241, elevFt: 212, surface: 'concrete', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 110.30, ident: 'ICQ', course: 176.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH40X' } },
        { ident: '36R', paired: '18L', hdgTrue: 356.9, hdgMag: 0.0, lengthFt: 12467, widthFt: 197, lat: 28.17486, lon: 113.22451, elevFt: 188, surface: 'concrete', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 109.30, ident: 'ICR', course: 356.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } },
        { ident: '18R', paired: '36L', hdgTrue: 177.9, hdgMag: 181.0, lengthFt: 10499, widthFt: 148, lat: 28.20353, lon: 113.21889, elevFt: 217, surface: 'asphalt', toraFt: 10499, ldaFt: 10499,
          ils: { freq: 111.10, ident: 'ICS', course: 177.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '36L', paired: '18R', hdgTrue: 357.9, hdgMag: 1.0, lengthFt: 10499, widthFt: 148, lat: 28.17477, lon: 113.22011, elevFt: 197, surface: 'asphalt', toraFt: 10499, ldaFt: 10499,
          ils: null }
      ]
    },
    {
      icao: 'ZSQD', iata: 'TAO',
      name: 'Qingdao Jiaodong International Airport', nameZh: '青岛胶东国际机场',
      city: 'Qingdao', cityZh: '青岛', country: 'China', countryZh: '中国',
      region: 'china', lat: 36.36195, lon: 120.08817, elevFt: 30, magVar: -6.2, tz: 8,
      transitionAltFt: 9800, size: 'large',
      runways: [
        { ident: '16', paired: '34', hdgTrue: 153.8, hdgMag: 160.0, lengthFt: 11811, widthFt: 197, lat: 36.38034, lon: 120.09043, elevFt: 27, surface: 'concrete', toraFt: 11811, ldaFt: 11811,
          ils: { freq: 111.10, ident: 'IQF', course: 153.8, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '34', paired: '16', hdgTrue: 333.8, hdgMag: 340.0, lengthFt: 11811, widthFt: 197, lat: 36.35129, lon: 120.10818, elevFt: 27, surface: 'concrete', toraFt: 11811, ldaFt: 11811,
          ils: null },
        { ident: '17', paired: '35', hdgTrue: 162.4, hdgMag: 168.6, lengthFt: 11811, widthFt: 148, lat: 36.37102, lon: 120.07172, elevFt: 28, surface: 'concrete', toraFt: 11811, ldaFt: 11811,
          ils: { freq: 110.30, ident: 'IQD', course: 162.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '35', paired: '17', hdgTrue: 342.4, hdgMag: 348.6, lengthFt: 11811, widthFt: 148, lat: 36.34010, lon: 120.08387, elevFt: 28, surface: 'concrete', toraFt: 11811, ldaFt: 11811,
          ils: { freq: 109.30, ident: 'IQE', course: 342.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } }
      ]
    },
    {
      icao: 'ZYTX', iata: 'SHE',
      name: 'Shenyang Taoxian International Airport', nameZh: '沈阳桃仙国际机场',
      city: 'Shenyang', cityZh: '沈阳', country: 'China', countryZh: '中国',
      region: 'china', lat: 41.63980, lon: 123.48367, elevFt: 198, magVar: -8.3, tz: 8,
      transitionAltFt: 9800, size: 'large',
      runways: [
        { ident: '06', paired: '24', hdgTrue: 48.9, hdgMag: 57.2, lengthFt: 10499, widthFt: 148, lat: 41.63040, lon: 123.46900, elevFt: 171, surface: 'concrete', toraFt: 10499, ldaFt: 10499,
          ils: { freq: 110.30, ident: 'ITX', course: 48.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH40X' } },
        { ident: '24', paired: '06', hdgTrue: 228.9, hdgMag: 237.2, lengthFt: 10499, widthFt: 148, lat: 41.64930, lon: 123.49800, elevFt: 197, surface: 'concrete', toraFt: 10499, ldaFt: 10499,
          ils: null }
      ]
    },
    {
      icao: 'ZJSY', iata: 'SYX',
      name: 'Sanya Phoenix International Airport', nameZh: '三亚凤凰国际机场',
      city: 'Sanya', cityZh: '三亚', country: 'China', countryZh: '中国',
      region: 'china', lat: 18.30290, lon: 109.41200, elevFt: 92, magVar: -1.1, tz: 8,
      transitionAltFt: 9800, size: 'large',
      runways: [
        { ident: '08', paired: '26', hdgTrue: 82.1, hdgMag: 83.2, lengthFt: 11155, widthFt: 148, lat: 18.30080, lon: 109.39600, elevFt: 62, surface: 'concrete', toraFt: 11155, ldaFt: 11155,
          ils: { freq: 110.30, ident: 'IJY', course: 82.1, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH40X' } },
        { ident: '26', paired: '08', hdgTrue: 262.1, hdgMag: 263.2, lengthFt: 11155, widthFt: 148, lat: 18.30500, lon: 109.42800, elevFt: 89, surface: 'concrete', toraFt: 11155, ldaFt: 11155,
          ils: null }
      ]
    },
    {
      icao: 'ZGKL', iata: 'KWL',
      name: 'Guilin Liangjiang International Airport', nameZh: '桂林两江国际机场',
      city: 'Guilin', cityZh: '桂林', country: 'China', countryZh: '中国',
      region: 'china', lat: 25.21983, lon: 110.03955, elevFt: 570, magVar: -2.1, tz: 8,
      transitionAltFt: 9800, size: 'medium',
      runways: [
        { ident: '01', paired: '19', hdgTrue: 4.1, hdgMag: 6.2, lengthFt: 10499, widthFt: 147, lat: 25.20375, lon: 110.03786, elevFt: 571, surface: 'concrete', toraFt: 10499, ldaFt: 10499,
          ils: { freq: 110.30, ident: 'IKL', course: 4.1, gsAngle: 3.00, gsDistNm: 10, type: 'CAT I', dmeChannel: 'CH40X' } },
        { ident: '19', paired: '01', hdgTrue: 184.1, hdgMag: 186.2, lengthFt: 10499, widthFt: 147, lat: 25.23245, lon: 110.04014, elevFt: 564, surface: 'concrete', toraFt: 10499, ldaFt: 10499,
          ils: { freq: 109.30, ident: 'IKW', course: 184.1, gsAngle: 3.00, gsDistNm: 10, type: 'CAT I', dmeChannel: 'CH30X' } }
      ]
    },
    {
      icao: 'ZBTJ', iata: 'TSN',
      name: 'Tianjin Binhai International Airport', nameZh: '天津滨海国际机场',
      city: 'Tianjin', cityZh: '天津', country: 'China', countryZh: '中国',
      region: 'china', lat: 39.12440, lon: 117.34600, elevFt: 10, magVar: -6.2, tz: 8,
      transitionAltFt: 9800, size: 'large',
      runways: [
        { ident: '16L', paired: '34R', hdgTrue: 154.6, hdgMag: 160.8, lengthFt: 10499, widthFt: 148, lat: 39.14148, lon: 117.36261, elevFt: 12, surface: 'concrete', toraFt: 10499, ldaFt: 10499,
          ils: { freq: 111.10, ident: 'ITL', course: 154.6, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '34R', paired: '16L', hdgTrue: 334.6, hdgMag: 340.8, lengthFt: 10499, widthFt: 148, lat: 39.11546, lon: 117.37856, elevFt: 12, surface: 'concrete', toraFt: 10499, ldaFt: 10499,
          ils: { freq: 110.70, ident: 'ITM', course: 334.6, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } },
        { ident: '16R', paired: '34L', hdgTrue: 154.5, hdgMag: 160.7, lengthFt: 11811, widthFt: 197, lat: 39.13899, lon: 117.33721, elevFt: 8, surface: 'concrete', toraFt: 11811, ldaFt: 11811,
          ils: { freq: 110.30, ident: 'ITJ', course: 154.5, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '34L', paired: '16R', hdgTrue: 334.5, hdgMag: 340.7, lengthFt: 11811, widthFt: 197, lat: 39.10976, lon: 117.35515, elevFt: 8, surface: 'concrete', toraFt: 11811, ldaFt: 11811,
          ils: { freq: 109.30, ident: 'ITK', course: 334.5, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } }
      ]
    },
    {
      icao: 'ZSSH', iata: 'HIA',
      name: 'Huai\'an Lianshui International Airport', nameZh: '淮安涟水国际机场',
      city: 'Huai\'an', cityZh: '淮安', country: 'China', countryZh: '中国',
      region: 'china', lat: 33.79271, lon: 119.12666, elevFt: 28, magVar: -5.2, tz: 8,
      transitionAltFt: 9800, size: 'medium',
      runways: [
        { ident: '04', paired: '22', hdgTrue: 35.6, hdgMag: 40.8, lengthFt: 9186, widthFt: 148, lat: 33.78211, lon: 119.11754, elevFt: 34, surface: 'concrete', toraFt: 9186, ldaFt: 9186,
          ils: { freq: 110.30, ident: 'IHS', course: 35.6, gsAngle: 3.00, gsDistNm: 10, type: 'CAT I', dmeChannel: 'CH40X' } },
        { ident: '22', paired: '04', hdgTrue: 215.6, hdgMag: 220.8, lengthFt: 9186, widthFt: 148, lat: 33.80260, lon: 119.13519, elevFt: 34, surface: 'concrete', toraFt: 9186, ldaFt: 9186,
          ils: null }
      ]
    },
    {
      icao: 'ZUXC', iata: 'XIC',
      name: 'Xichang Qingshan Airport', nameZh: '西昌青山机场',
      city: 'Xichang', cityZh: '西昌', country: 'China', countryZh: '中国',
      region: 'china', lat: 27.98910, lon: 102.18400, elevFt: 5112, magVar: -1.2, tz: 8,
      transitionAltFt: 9800, size: 'small',
      runways: [
        { ident: '18', paired: '36', hdgTrue: 178.4, hdgMag: 179.6, lengthFt: 11811, widthFt: 164, lat: 28.00530, lon: 102.18400, elevFt: 5112, surface: 'concrete', toraFt: 11811, ldaFt: 11811,
          ils: { freq: 110.30, ident: 'IGY', course: 178.4, gsAngle: 3.00, gsDistNm: 10, type: 'CAT I', dmeChannel: 'CH40X' } },
        { ident: '36', paired: '18', hdgTrue: 358.4, hdgMag: 359.6, lengthFt: 11811, widthFt: 164, lat: 27.97280, lon: 102.18500, elevFt: 5069, surface: 'concrete', toraFt: 11811, ldaFt: 11811,
          ils: null }
      ]
    },
    {
      icao: 'ZLLL', iata: 'LHW',
      name: 'Lanzhou Zhongchuan International Airport', nameZh: '兰州中川国际机场',
      city: 'Lanzhou', cityZh: '兰州', country: 'China', countryZh: '中国',
      region: 'china', lat: 36.51520, lon: 103.62000, elevFt: 6388, magVar: -2.0, tz: 8,
      transitionAltFt: 11800, size: 'large',
      runways: [
        { ident: '18L', paired: '36R', hdgTrue: 177.1, hdgMag: 179.1, lengthFt: 13123, widthFt: 148, lat: 36.53161, lon: 103.62379, elevFt: 6388, surface: 'asphalt', toraFt: 13123, ldaFt: 13123,
          ils: { freq: 110.30, ident: 'ILZ', course: 177.1, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH40X' } },
        { ident: '36R', paired: '18L', hdgTrue: 357.1, hdgMag: 359.1, lengthFt: 13123, widthFt: 148, lat: 36.49562, lon: 103.62608, elevFt: 6329, surface: 'asphalt', toraFt: 13123, ldaFt: 13123,
          ils: { freq: 109.30, ident: 'ILA', course: 357.1, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } },
        { ident: '18R', paired: '36L', hdgTrue: 177.1, hdgMag: 179.1, lengthFt: 11811, widthFt: 148, lat: 36.53085, lon: 103.60534, elevFt: 6388, surface: 'asphalt', toraFt: 11811, ldaFt: 11811,
          ils: { freq: 111.10, ident: 'ILB', course: 177.1, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '36L', paired: '18R', hdgTrue: 357.1, hdgMag: 359.1, lengthFt: 11811, widthFt: 148, lat: 36.56318, lon: 103.60328, elevFt: 6388, surface: 'asphalt', toraFt: 11811, ldaFt: 11811,
          ils: null }
      ]
    },
    {
      icao: 'ZWWW', iata: 'URC',
      name: 'Urumqi Tianshan International Airport', nameZh: '乌鲁木齐天山国际机场',
      city: 'Urumqi', cityZh: '乌鲁木齐', country: 'China', countryZh: '中国',
      region: 'china', lat: 43.91358, lon: 87.47937, elevFt: 2125, magVar: 2.5, tz: 8,
      transitionAltFt: 9800, size: 'large',
      runways: [
        { ident: '07', paired: '25', hdgTrue: 73.5, hdgMag: 71.0, lengthFt: 11811, widthFt: 148, lat: 43.90250, lon: 87.45270, elevFt: 2123, surface: 'asphalt', toraFt: 11811, ldaFt: 11811,
          ils: { freq: 110.30, ident: 'IUR', course: 73.5, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH40X' } },
        { ident: '25', paired: '07', hdgTrue: 253.5, hdgMag: 251.0, lengthFt: 11811, widthFt: 148, lat: 43.91170, lon: 87.49580, elevFt: 2126, surface: 'asphalt', toraFt: 11811, ldaFt: 11811,
          ils: { freq: 109.30, ident: 'IUS', course: 253.5, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } },
        { ident: '08L', paired: '26R', hdgTrue: 82.5, hdgMag: 80.0, lengthFt: 10498, widthFt: 198, lat: 43.92582, lon: 87.45382, elevFt: 2091, surface: 'concrete', toraFt: 10498, ldaFt: 10498,
          ils: { freq: 109.90, ident: 'IUV', course: 82.5, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH36X' } },
        { ident: '26R', paired: '08L', hdgTrue: 262.5, hdgMag: 260.0, lengthFt: 10498, widthFt: 198, lat: 43.92957, lon: 87.49343, elevFt: 2091, surface: 'concrete', toraFt: 10498, ldaFt: 10498,
          ils: null },
        { ident: '08R', paired: '26L', hdgTrue: 82.5, hdgMag: 80.0, lengthFt: 11811, widthFt: 198, lat: 43.92178, lon: 87.45027, elevFt: 2094, surface: 'concrete', toraFt: 11811, ldaFt: 11811,
          ils: { freq: 111.10, ident: 'IUT', course: 82.5, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '26L', paired: '08R', hdgTrue: 262.5, hdgMag: 260.0, lengthFt: 11811, widthFt: 198, lat: 43.92601, lon: 87.49483, elevFt: 2094, surface: 'concrete', toraFt: 11811, ldaFt: 11811,
          ils: { freq: 108.90, ident: 'IUU', course: 262.5, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } }
      ]
    },
    {
      icao: 'ZBHH', iata: 'HET',
      name: 'Hohhot Baita International Airport', nameZh: '呼和浩特白塔国际机场',
      city: 'Hohhot', cityZh: '呼和浩特', country: 'China', countryZh: '中国',
      region: 'china', lat: 40.84966, lon: 111.82460, elevFt: 3556, magVar: -5.1, tz: 8,
      transitionAltFt: 9800, size: 'medium',
      runways: [
        { ident: '08', paired: '26', hdgTrue: 71.9, hdgMag: 77.0, lengthFt: 11811, widthFt: 148, lat: 40.84642, lon: 111.80366, elevFt: 3511, surface: 'concrete', toraFt: 11811, ldaFt: 11811,
          ils: { freq: 110.30, ident: 'IHT', course: 71.9, gsAngle: 3.00, gsDistNm: 10, type: 'CAT II', dmeChannel: 'CH40X' } },
        { ident: '26', paired: '08', hdgTrue: 251.9, hdgMag: 257.0, lengthFt: 11811, widthFt: 148, lat: 40.85648, lon: 111.84434, elevFt: 3556, surface: 'concrete', toraFt: 11811, ldaFt: 11811,
          ils: null }
      ]
    },
    /* ------------------------- 亚洲其他 Asia ------------------------- */
    {
      icao: 'VHHH', iata: 'HKG',
      name: 'Hong Kong International Airport', nameZh: '香港国际机场',
      city: 'Hong Kong', cityZh: '香港', country: 'Hong Kong', countryZh: '中国香港',
      region: 'asia', lat: 22.31184, lon: 113.91486, elevFt: 28, magVar: -2.1, tz: 8,
      transitionAltFt: 9000, size: 'large',
      runways: [
        { ident: '07C', paired: '25C', hdgTrue: 70.9, hdgMag: 73.0, lengthFt: 12467, widthFt: 197, lat: 22.31040, lon: 113.89600, elevFt: 22, surface: 'asphalt', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 110.90, ident: 'IHC', course: 70.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH46X' } },
        { ident: '25C', paired: '07C', hdgTrue: 250.9, hdgMag: 253.0, lengthFt: 12467, widthFt: 197, lat: 22.32160, lon: 113.93100, elevFt: 23, surface: 'asphalt', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 110.30, ident: 'IHD', course: 250.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '07L', paired: '25R', hdgTrue: 70.8, hdgMag: 72.9, lengthFt: 12467, widthFt: 197, lat: 22.32107, lon: 113.88069, elevFt: 23, surface: 'asphalt', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 111.10, ident: 'IHL', course: 70.8, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH48X' } },
        { ident: '25R', paired: '07L', hdgTrue: 250.8, hdgMag: 252.9, lengthFt: 12467, widthFt: 197, lat: 22.33231, lon: 113.91556, elevFt: 23, surface: 'asphalt', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 109.30, ident: 'IHR', course: 250.8, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH30X' } },
        { ident: '07R', paired: '25L', hdgTrue: 70.8, hdgMag: 72.9, lengthFt: 12467, widthFt: 197, lat: 22.29620, lon: 113.89800, elevFt: 28, surface: 'asphalt', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 109.10, ident: 'IHE', course: 70.8, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH28X' } },
        { ident: '25L', paired: '07R', hdgTrue: 250.8, hdgMag: 252.9, lengthFt: 12467, widthFt: 197, lat: 22.30743, lon: 113.93282, elevFt: 27, surface: 'asphalt', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 108.90, ident: 'IHF', course: 250.8, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH26X' } }
      ]
    },
    {
      icao: 'RCTP', iata: 'TPE',
      name: 'Taiwan Taoyuan International Airport', nameZh: '台湾桃园国际机场',
      city: 'Taoyuan', cityZh: '桃园', country: 'Taiwan, China', countryZh: '中国台湾',
      region: 'asia', lat: 25.07770, lon: 121.23300, elevFt: 106, magVar: -3.4, tz: 8,
      transitionAltFt: 11000, size: 'large',
      runways: [
        { ident: '05L', paired: '23R', hdgTrue: 49.0, hdgMag: 52.4, lengthFt: 12008, widthFt: 197, lat: 25.07290, lon: 121.21600, elevFt: 73, surface: 'concrete', toraFt: 12008, ldaFt: 12008,
          ils: { freq: 110.30, ident: 'ITP', course: 49.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '23R', paired: '05L', hdgTrue: 229.0, hdgMag: 232.4, lengthFt: 12008, widthFt: 197, lat: 25.09447, lon: 121.24338, elevFt: 62, surface: 'concrete', toraFt: 12008, ldaFt: 12008,
          ils: { freq: 109.30, ident: 'ITQ', course: 229.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } },
        { ident: '05R', paired: '23L', hdgTrue: 49.0, hdgMag: 52.4, lengthFt: 10991, widthFt: 197, lat: 25.06218, lon: 121.22520, elevFt: 106, surface: 'concrete', toraFt: 10991, ldaFt: 10991,
          ils: { freq: 111.10, ident: 'ITR', course: 49.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '23L', paired: '05R', hdgTrue: 229.0, hdgMag: 232.4, lengthFt: 10991, widthFt: 197, lat: 25.08196, lon: 121.25029, elevFt: 95, surface: 'concrete', toraFt: 10991, ldaFt: 10991,
          ils: { freq: 110.70, ident: 'ITS', course: 229.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } }
      ]
    },
    {
      icao: 'RJTT', iata: 'HND',
      name: 'Tokyo Haneda International Airport', nameZh: '东京羽田国际机场',
      city: 'Tokyo', cityZh: '东京', country: 'Japan', countryZh: '日本',
      region: 'asia', lat: 35.54968, lon: 139.78696, elevFt: 35, magVar: -6.5, tz: 9,
      transitionAltFt: 14000, size: 'large',
      runways: [
        { ident: '04', paired: '22', hdgTrue: 34.9, hdgMag: 41.4, lengthFt: 8202, widthFt: 200, lat: 35.54901, lon: 139.76127, elevFt: 19, surface: 'asphalt', toraFt: 8202, ldaFt: 8202,
          ils: { freq: 108.90, ident: 'ITX', course: 34.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '22', paired: '04', hdgTrue: 214.9, hdgMag: 221.4, lengthFt: 8202, widthFt: 200, lat: 35.56746, lon: 139.77711, elevFt: 35, surface: 'asphalt', toraFt: 8202, ldaFt: 8202,
          ils: { freq: 109.90, ident: 'ITY', course: 214.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH36X' } },
        { ident: '05', paired: '23', hdgTrue: 42.4, hdgMag: 48.9, lengthFt: 8202, widthFt: 200, lat: 35.52400, lon: 139.80347, elevFt: 46, surface: 'asphalt', toraFt: 8202, ldaFt: 8202,
          ils: { freq: 111.70, ident: 'ITZ', course: 42.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH54X' } },
        { ident: '23', paired: '05', hdgTrue: 222.4, hdgMag: 228.9, lengthFt: 8202, widthFt: 200, lat: 35.54060, lon: 139.82213, elevFt: 55, surface: 'asphalt', toraFt: 8202, ldaFt: 8202,
          ils: { freq: 111.90, ident: 'IUA', course: 222.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH56X' } },
        { ident: '16L', paired: '34R', hdgTrue: 150.0, hdgMag: 156.5, lengthFt: 11024, widthFt: 200, lat: 35.56590, lon: 139.78655, elevFt: 22, surface: 'asphalt', toraFt: 11024, ldaFt: 11024,
          ils: { freq: 110.30, ident: 'ITT', course: 150.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '34R', paired: '16L', hdgTrue: 330.0, hdgMag: 336.5, lengthFt: 11024, widthFt: 200, lat: 35.53969, lon: 139.80514, elevFt: 20, surface: 'asphalt', toraFt: 11024, ldaFt: 11024,
          ils: { freq: 109.30, ident: 'ITU', course: 330.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH30X' } },
        { ident: '16R', paired: '34L', hdgTrue: 150.0, hdgMag: 156.5, lengthFt: 9843, widthFt: 200, lat: 35.56045, lon: 139.76873, elevFt: 20, surface: 'asphalt', toraFt: 9843, ldaFt: 9843,
          ils: { freq: 111.10, ident: 'ITV', course: 150.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH48X' } },
        { ident: '34L', paired: '16R', hdgTrue: 330.0, hdgMag: 336.5, lengthFt: 9843, widthFt: 200, lat: 35.53659, lon: 139.78567, elevFt: 20, surface: 'asphalt', toraFt: 9843, ldaFt: 9843,
          ils: { freq: 110.70, ident: 'ITW', course: 330.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH44X' } }
      ]
    },
    {
      icao: 'RJAA', iata: 'NRT',
      name: 'Narita International Airport', nameZh: '东京成田国际机场',
      city: 'Narita', cityZh: '成田', country: 'Japan', countryZh: '日本',
      region: 'asia', lat: 35.76858, lon: 140.38871, elevFt: 141, magVar: -6.5, tz: 9,
      transitionAltFt: 14000, size: 'large',
      runways: [
        { ident: '16L', paired: '34R', hdgTrue: 150.1, hdgMag: 156.6, lengthFt: 8202, widthFt: 196, lat: 35.80399, lon: 140.37909, elevFt: 135, surface: 'asphalt', toraFt: 8202, ldaFt: 8202,
          ils: { freq: 111.10, ident: 'INT', course: 150.1, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '34R', paired: '16L', hdgTrue: 330.1, hdgMag: 336.6, lengthFt: 8202, widthFt: 196, lat: 35.78451, lon: 140.39292, elevFt: 141, surface: 'asphalt', toraFt: 8202, ldaFt: 8202,
          ils: { freq: 110.70, ident: 'INU', course: 330.1, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } },
        { ident: '16R', paired: '34L', hdgTrue: 149.0, hdgMag: 155.5, lengthFt: 13123, widthFt: 196, lat: 35.77440, lon: 140.36800, elevFt: 130, surface: 'asphalt', toraFt: 13123, ldaFt: 13123,
          ils: { freq: 110.30, ident: 'INR', course: 149.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '34L', paired: '16R', hdgTrue: 329.0, hdgMag: 335.5, lengthFt: 13123, widthFt: 196, lat: 35.74330, lon: 140.39101, elevFt: 139, surface: 'asphalt', toraFt: 13123, ldaFt: 13123,
          ils: { freq: 109.30, ident: 'INS', course: 329.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } }
      ]
    },
    {
      icao: 'RJBB', iata: 'KIX',
      name: 'Kansai International Airport', nameZh: '大阪关西国际机场',
      city: 'Osaka', cityZh: '大阪', country: 'Japan', countryZh: '日本',
      region: 'asia', lat: 34.42730, lon: 135.24400, elevFt: 26, magVar: -6.6, tz: 9,
      transitionAltFt: 14000, size: 'large',
      runways: [
        { ident: '06L', paired: '24R', hdgTrue: 50.7, hdgMag: 57.3, lengthFt: 13123, widthFt: 196, lat: 34.42850, lon: 135.20616, elevFt: 24, surface: 'asphalt', toraFt: 13123, ldaFt: 13123,
          ils: { freq: 110.30, ident: 'IKB', course: 50.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '24R', paired: '06L', hdgTrue: 230.7, hdgMag: 237.3, lengthFt: 13123, widthFt: 196, lat: 34.45133, lon: 135.24001, elevFt: 32, surface: 'asphalt', toraFt: 13123, ldaFt: 13123,
          ils: { freq: 109.30, ident: 'IKC', course: 230.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } },
        { ident: '06R', paired: '24L', hdgTrue: 51.3, hdgMag: 57.9, lengthFt: 11483, widthFt: 196, lat: 34.41740, lon: 135.22900, elevFt: 6, surface: 'asphalt', toraFt: 11483, ldaFt: 11483,
          ils: { freq: 111.10, ident: 'IKD', course: 51.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '24L', paired: '06R', hdgTrue: 231.3, hdgMag: 237.9, lengthFt: 11483, widthFt: 196, lat: 34.43720, lon: 135.25900, elevFt: 15, surface: 'asphalt', toraFt: 11483, ldaFt: 11483,
          ils: { freq: 110.70, ident: 'IKE', course: 231.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } }
      ]
    },
    {
      icao: 'RKSI', iata: 'ICN',
      name: 'Incheon International Airport', nameZh: '首尔仁川国际机场',
      city: 'Seoul', cityZh: '首尔', country: 'South Korea', countryZh: '韩国',
      region: 'asia', lat: 37.46910, lon: 126.45100, elevFt: 23, magVar: -7.4, tz: 9,
      transitionAltFt: 14000, size: 'large',
      runways: [
        { ident: '15L', paired: '33R', hdgTrue: 144.2, hdgMag: 151.6, lengthFt: 12303, widthFt: 197, lat: 37.48390, lon: 126.44000, elevFt: 23, surface: 'asphalt', toraFt: 12303, ldaFt: 12303,
          ils: { freq: 111.10, ident: 'IIU', course: 144.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH48X' } },
        { ident: '33R', paired: '15L', hdgTrue: 324.2, hdgMag: 331.6, lengthFt: 12303, widthFt: 197, lat: 37.45640, lon: 126.46500, elevFt: 23, surface: 'asphalt', toraFt: 12303, ldaFt: 12303,
          ils: { freq: 110.70, ident: 'IIV', course: 324.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH44X' } },
        { ident: '15R', paired: '33L', hdgTrue: 144.3, hdgMag: 151.7, lengthFt: 12303, widthFt: 197, lat: 37.48180, lon: 126.43600, elevFt: 23, surface: 'asphalt', toraFt: 12303, ldaFt: 12303,
          ils: { freq: 110.30, ident: 'IIS', course: 144.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '33L', paired: '15R', hdgTrue: 324.3, hdgMag: 331.7, lengthFt: 12303, widthFt: 197, lat: 37.45420, lon: 126.46100, elevFt: 23, surface: 'asphalt', toraFt: 12303, ldaFt: 12303,
          ils: { freq: 109.30, ident: 'IIT', course: 324.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH30X' } },
        { ident: '16L', paired: '34R', hdgTrue: 152.6, hdgMag: 160.0, lengthFt: 13123, widthFt: 197, lat: 37.47405, lon: 126.41823, elevFt: 23, surface: 'asphalt', toraFt: 13123, ldaFt: 13123,
          ils: { freq: 108.90, ident: 'IIW', course: 152.6, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '34R', paired: '16L', hdgTrue: 332.6, hdgMag: 340.0, lengthFt: 13123, widthFt: 197, lat: 37.44212, lon: 126.43909, elevFt: 23, surface: 'asphalt', toraFt: 13123, ldaFt: 13123,
          ils: null },
        { ident: '16R', paired: '34L', hdgTrue: 152.6, hdgMag: 160.0, lengthFt: 12303, widthFt: 197, lat: 37.46998, lon: 126.41589, elevFt: 23, surface: 'asphalt', toraFt: 12303, ldaFt: 12303,
          ils: { freq: 109.90, ident: 'IIX', course: 152.6, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH36X' } },
        { ident: '34L', paired: '16R', hdgTrue: 332.6, hdgMag: 340.0, lengthFt: 12303, widthFt: 197, lat: 37.44004, lon: 126.43544, elevFt: 23, surface: 'asphalt', toraFt: 12303, ldaFt: 12303,
          ils: null }
      ]
    },
    {
      icao: 'WSSS', iata: 'SIN',
      name: 'Singapore Changi Airport', nameZh: '新加坡樟宜机场',
      city: 'Singapore', cityZh: '新加坡', country: 'Singapore', countryZh: '新加坡',
      region: 'asia', lat: 1.35019, lon: 103.99400, elevFt: 22, magVar: 0.2, tz: 8,
      transitionAltFt: 11000, size: 'large',
      runways: [
        { ident: '02C', paired: '20C', hdgTrue: 22.8, hdgMag: 22.6, lengthFt: 13123, widthFt: 197, lat: 1.32880, lon: 103.98500, elevFt: 15, surface: 'concrete', toraFt: 13123, ldaFt: 13123,
          ils: { freq: 111.10, ident: 'ISN', course: 22.8, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH48X' } },
        { ident: '20C', paired: '02C', hdgTrue: 202.8, hdgMag: 202.6, lengthFt: 13123, widthFt: 197, lat: 1.36213, lon: 103.99900, elevFt: 15, surface: 'concrete', toraFt: 13123, ldaFt: 13123,
          ils: { freq: 110.70, ident: 'ISO', course: 202.8, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH44X' } },
        { ident: '02L', paired: '20R', hdgTrue: 22.7, hdgMag: 22.5, lengthFt: 13123, widthFt: 197, lat: 1.34897, lon: 103.97800, elevFt: 22, surface: 'concrete', toraFt: 13123, ldaFt: 13123,
          ils: { freq: 110.30, ident: 'ISL', course: 22.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '20R', paired: '02L', hdgTrue: 202.7, hdgMag: 202.5, lengthFt: 13123, widthFt: 197, lat: 1.38241, lon: 103.99200, elevFt: 14, surface: 'concrete', toraFt: 13123, ldaFt: 13123,
          ils: { freq: 109.30, ident: 'ISM', course: 202.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH30X' } }
      ]
    },
    {
      icao: 'WMKK', iata: 'KUL',
      name: 'Kuala Lumpur International Airport', nameZh: '吉隆坡国际机场',
      city: 'Kuala Lumpur', cityZh: '吉隆坡', country: 'Malaysia', countryZh: '马来西亚',
      region: 'asia', lat: 2.74558, lon: 101.71000, elevFt: 69, magVar: 0.0, tz: 8,
      transitionAltFt: 11000, size: 'large',
      runways: [
        { ident: '14L', paired: '32R', hdgTrue: 140.0, hdgMag: 140.0, lengthFt: 13530, widthFt: 197, lat: 2.77704, lon: 101.70007, elevFt: 55, surface: 'concrete', toraFt: 13530, ldaFt: 13530,
          ils: { freq: 110.30, ident: 'IKQ', course: 140.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '32R', paired: '14L', hdgTrue: 320.0, hdgMag: 320.0, lengthFt: 13530, widthFt: 197, lat: 2.74863, lon: 101.72393, elevFt: 70, surface: 'concrete', toraFt: 13530, ldaFt: 13530,
          ils: { freq: 109.30, ident: 'IKR', course: 320.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } },
        { ident: '14R', paired: '32L', hdgTrue: 140.0, hdgMag: 140.0, lengthFt: 13288, widthFt: 197, lat: 2.74227, lon: 101.69628, elevFt: 54, surface: 'concrete', toraFt: 13288, ldaFt: 13288,
          ils: { freq: 111.10, ident: 'IKS', course: 140.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH48X' } },
        { ident: '32L', paired: '14R', hdgTrue: 320.0, hdgMag: 320.0, lengthFt: 13288, widthFt: 197, lat: 2.71437, lon: 101.71972, elevFt: 48, surface: 'concrete', toraFt: 13288, ldaFt: 13288,
          ils: { freq: 110.70, ident: 'IKT', course: 320.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } },
        { ident: '15', paired: '33', hdgTrue: 146.3, hdgMag: 146.3, lengthFt: 12993, widthFt: 197, lat: 2.73817, lon: 101.67750, elevFt: 27, surface: 'concrete', toraFt: 12993, ldaFt: 12993,
          ils: { freq: 108.90, ident: 'IKU', course: 146.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '33', paired: '15', hdgTrue: 326.3, hdgMag: 326.3, lengthFt: 12993, widthFt: 197, lat: 2.70850, lon: 101.69733, elevFt: 27, surface: 'concrete', toraFt: 12993, ldaFt: 12993,
          ils: { freq: 109.90, ident: 'IKV', course: 326.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH36X' } }
      ]
    },
    {
      icao: 'VTBS', iata: 'BKK',
      name: 'Suvarnabhumi Airport', nameZh: '曼谷素万那普国际机场',
      city: 'Bangkok', cityZh: '曼谷', country: 'Thailand', countryZh: '泰国',
      region: 'asia', lat: 13.68110, lon: 100.74700, elevFt: 5, magVar: -0.4, tz: 7,
      transitionAltFt: 11000, size: 'large',
      runways: [
        { ident: '01', paired: '19', hdgTrue: 14.3, hdgMag: 14.7, lengthFt: 13123, widthFt: 197, lat: 13.65670, lon: 100.75183, elevFt: 5, surface: 'asphalt', toraFt: 13123, ldaFt: 13123,
          ils: { freq: 108.90, ident: 'IBW', course: 14.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '19', paired: '01', hdgTrue: 194.3, hdgMag: 194.7, lengthFt: 13123, widthFt: 197, lat: 13.69171, lon: 100.76103, elevFt: 5, surface: 'asphalt', toraFt: 13123, ldaFt: 13123,
          ils: { freq: 109.90, ident: 'IBX', course: 194.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH36X' } },
        { ident: '02L', paired: '20R', hdgTrue: 14.3, hdgMag: 14.7, lengthFt: 13123, widthFt: 197, lat: 13.66517, lon: 100.72924, elevFt: 5, surface: 'asphalt', toraFt: 13123, ldaFt: 13123,
          ils: { freq: 110.30, ident: 'IBS', course: 14.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '20R', paired: '02L', hdgTrue: 194.3, hdgMag: 194.7, lengthFt: 13123, widthFt: 197, lat: 13.70016, lon: 100.73844, elevFt: 5, surface: 'asphalt', toraFt: 13123, ldaFt: 13123,
          ils: { freq: 109.30, ident: 'IBT', course: 194.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH30X' } },
        { ident: '02R', paired: '20L', hdgTrue: 14.3, hdgMag: 14.7, lengthFt: 12139, widthFt: 197, lat: 13.67128, lon: 100.73467, elevFt: 5, surface: 'asphalt', toraFt: 12139, ldaFt: 12139,
          ils: { freq: 111.10, ident: 'IBU', course: 14.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH48X' } },
        { ident: '20L', paired: '02R', hdgTrue: 194.3, hdgMag: 194.7, lengthFt: 12139, widthFt: 197, lat: 13.70367, lon: 100.74318, elevFt: 5, surface: 'asphalt', toraFt: 12139, ldaFt: 12139,
          ils: { freq: 110.70, ident: 'IBV', course: 194.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } }
      ]
    },
    {
      icao: 'VVTS', iata: 'SGN',
      name: 'Tan Son Nhat International Airport', nameZh: '胡志明市新山一国际机场',
      city: 'Ho Chi Minh City', cityZh: '胡志明市', country: 'Vietnam', countryZh: '越南',
      region: 'asia', lat: 10.81880, lon: 106.65200, elevFt: 33, magVar: -0.1, tz: 7,
      transitionAltFt: 11000, size: 'large',
      runways: [
        { ident: '07L', paired: '25R', hdgTrue: 68.8, hdgMag: 68.9, lengthFt: 10007, widthFt: 148, lat: 10.81500, lon: 106.63700, elevFt: 24, surface: 'concrete', toraFt: 10007, ldaFt: 10007,
          ils: { freq: 110.30, ident: 'ITA', course: 68.8, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH40X' } },
        { ident: '25R', paired: '07L', hdgTrue: 248.8, hdgMag: 248.9, lengthFt: 10007, widthFt: 148, lat: 10.82490, lon: 106.66300, elevFt: 32, surface: 'concrete', toraFt: 10007, ldaFt: 10007,
          ils: { freq: 109.30, ident: 'ITB', course: 248.8, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH30X' } },
        { ident: '07R', paired: '25L', hdgTrue: 69.4, hdgMag: 69.5, lengthFt: 12468, widthFt: 148, lat: 10.81150, lon: 106.63700, elevFt: 24, surface: 'concrete', toraFt: 12468, ldaFt: 12468,
          ils: { freq: 111.10, ident: 'ITC', course: 69.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '25L', paired: '07R', hdgTrue: 249.4, hdgMag: 249.5, lengthFt: 12468, widthFt: 148, lat: 10.82370, lon: 106.67000, elevFt: 32, surface: 'concrete', toraFt: 12468, ldaFt: 12468,
          ils: { freq: 110.70, ident: 'ITD', course: 249.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } }
      ]
    },
    {
      icao: 'RPLL', iata: 'MNL',
      name: 'Ninoy Aquino International Airport', nameZh: '马尼拉尼诺·阿基诺国际机场',
      city: 'Manila', cityZh: '马尼拉', country: 'Philippines', countryZh: '菲律宾',
      region: 'asia', lat: 14.50860, lon: 121.02000, elevFt: 75, magVar: -1.2, tz: 8,
      transitionAltFt: 11000, size: 'large',
      runways: [
        { ident: '06', paired: '24', hdgTrue: 60.1, hdgMag: 61.3, lengthFt: 12261, widthFt: 197, lat: 14.49780, lon: 121.00000, elevFt: 16, surface: 'concrete', toraFt: 12261, ldaFt: 12261,
          ils: { freq: 110.30, ident: 'IMA', course: 60.1, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH40X' } },
        { ident: '24', paired: '06', hdgTrue: 240.1, hdgMag: 241.3, lengthFt: 12261, widthFt: 197, lat: 14.51450, lon: 121.03000, elevFt: 75, surface: 'concrete', toraFt: 12261, ldaFt: 12261,
          ils: { freq: 109.30, ident: 'IMB', course: 240.1, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } },
        { ident: '13', paired: '31', hdgTrue: 128.8, hdgMag: 130.0, lengthFt: 7408, widthFt: 148, lat: 14.52336, lon: 121.00232, elevFt: 16, surface: 'concrete', toraFt: 7408, ldaFt: 7408,
          ils: { freq: 111.10, ident: 'IMC', course: 128.8, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '31', paired: '13', hdgTrue: 308.8, hdgMag: 310.0, lengthFt: 7408, widthFt: 148, lat: 14.51064, lon: 121.01867, elevFt: 42, surface: 'concrete', toraFt: 7408, ldaFt: 7408,
          ils: { freq: 110.70, ident: 'IMD', course: 308.8, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } }
      ]
    },
    {
      icao: 'VIDP', iata: 'DEL',
      name: 'Indira Gandhi International Airport', nameZh: '德里英迪拉·甘地国际机场',
      city: 'New Delhi', cityZh: '新德里', country: 'India', countryZh: '印度',
      region: 'asia', lat: 28.55563, lon: 77.09519, elevFt: 777, magVar: 0.4, tz: 5.5,
      transitionAltFt: 11000, size: 'large',
      runways: [
        { ident: '09', paired: '27', hdgTrue: 91.6, hdgMag: 91.2, lengthFt: 9229, widthFt: 148, lat: 28.57050, lon: 77.08800, elevFt: 717, surface: 'asphalt', toraFt: 9229, ldaFt: 9229,
          ils: { freq: 108.90, ident: 'IDU', course: 91.6, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '27', paired: '09', hdgTrue: 271.6, hdgMag: 271.2, lengthFt: 9229, widthFt: 148, lat: 28.56980, lon: 77.11700, elevFt: 750, surface: 'asphalt', toraFt: 9229, ldaFt: 9229,
          ils: { freq: 109.90, ident: 'IDV', course: 271.6, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH36X' } },
        { ident: '10', paired: '28', hdgTrue: 104.7, hdgMag: 104.3, lengthFt: 12500, widthFt: 148, lat: 28.56720, lon: 77.08480, elevFt: 719, surface: 'asphalt', toraFt: 12500, ldaFt: 12500,
          ils: { freq: 111.90, ident: 'IDX', course: 104.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH56X' } },
        { ident: '28', paired: '10', hdgTrue: 284.7, hdgMag: 284.3, lengthFt: 12500, widthFt: 148, lat: 28.55850, lon: 77.12250, elevFt: 777, surface: 'asphalt', toraFt: 12500, ldaFt: 12500,
          ils: { freq: 111.30, ident: 'IDY', course: 284.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH50X' } },
        { ident: '11L', paired: '29R', hdgTrue: 110.4, hdgMag: 110.0, lengthFt: 14436, widthFt: 148, lat: 28.55233, lon: 77.06891, elevFt: 749, surface: 'asphalt', toraFt: 14436, ldaFt: 14436,
          ils: { freq: 110.30, ident: 'IDL', course: 110.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '29R', paired: '11L', hdgTrue: 290.4, hdgMag: 290.0, lengthFt: 14436, widthFt: 148, lat: 28.53854, lon: 77.11114, elevFt: 749, surface: 'asphalt', toraFt: 14436, ldaFt: 14436,
          ils: { freq: 109.30, ident: 'IDR', course: 290.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH30X' } },
        { ident: '11R', paired: '29L', hdgTrue: 110.4, hdgMag: 110.0, lengthFt: 14534, widthFt: 197, lat: 28.54939, lon: 77.06625, elevFt: 720, surface: 'asphalt', toraFt: 14534, ldaFt: 14534,
          ils: { freq: 111.10, ident: 'IDS', course: 110.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH48X' } },
        { ident: '29L', paired: '11R', hdgTrue: 290.4, hdgMag: 290.0, lengthFt: 14534, widthFt: 197, lat: 28.53550, lon: 77.10876, elevFt: 776, surface: 'asphalt', toraFt: 14534, ldaFt: 14534,
          ils: { freq: 110.70, ident: 'IDT', course: 290.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH44X' } }
      ]
    },
    {
      icao: 'VABB', iata: 'BOM',
      name: 'Chhatrapati Shivaji Maharaj International Airport', nameZh: '孟买贾特拉帕蒂·希瓦吉国际机场',
      city: 'Mumbai', cityZh: '孟买', country: 'India', countryZh: '印度',
      region: 'asia', lat: 19.08870, lon: 72.86790, elevFt: 39, magVar: -0.5, tz: 5.5,
      transitionAltFt: 11000, size: 'large',
      runways: [
        { ident: '09', paired: '27', hdgTrue: 89.1, hdgMag: 89.6, lengthFt: 11511, widthFt: 197, lat: 19.08840, lon: 72.84800, elevFt: 15, surface: 'asphalt', toraFt: 11511, ldaFt: 11511,
          ils: { freq: 110.30, ident: 'IBN', course: 89.1, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH40X' } },
        { ident: '27', paired: '09', hdgTrue: 269.1, hdgMag: 269.6, lengthFt: 11511, widthFt: 197, lat: 19.08890, lon: 72.88110, elevFt: 22, surface: 'asphalt', toraFt: 11511, ldaFt: 11511,
          ils: { freq: 109.30, ident: 'IBO', course: 269.1, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } },
        { ident: '14', paired: '32', hdgTrue: 134.4, hdgMag: 134.9, lengthFt: 9419, widthFt: 148, lat: 19.09850, lon: 72.85730, elevFt: 37, surface: 'asphalt', toraFt: 9419, ldaFt: 9419,
          ils: { freq: 111.10, ident: 'IBP', course: 134.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '32', paired: '14', hdgTrue: 314.4, hdgMag: 314.9, lengthFt: 9419, widthFt: 148, lat: 19.08010, lon: 72.87720, elevFt: 26, surface: 'asphalt', toraFt: 9419, ldaFt: 9419,
          ils: { freq: 110.70, ident: 'IBQ', course: 314.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } }
      ]
    },
    /* ------------------------- 中东 Middle East ------------------------- */
    {
      icao: 'OMDB', iata: 'DXB',
      name: 'Dubai International Airport', nameZh: '迪拜国际机场',
      city: 'Dubai', cityZh: '迪拜', country: 'United Arab Emirates', countryZh: '阿联酋',
      region: 'middle-east', lat: 25.24979, lon: 55.37099, elevFt: 62, magVar: 1.3, tz: 4,
      transitionAltFt: 13000, size: 'large',
      runways: [
        { ident: '12L', paired: '30R', hdgTrue: 121.5, hdgMag: 120.2, lengthFt: 14275, widthFt: 197, lat: 25.26639, lon: 55.34723, elevFt: 11, surface: 'asphalt', toraFt: 14275, ldaFt: 14275,
          ils: { freq: 110.30, ident: 'IDB', course: 121.5, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '30R', paired: '12L', hdgTrue: 301.5, hdgMag: 300.2, lengthFt: 14275, widthFt: 197, lat: 25.24594, lon: 55.38412, elevFt: 32, surface: 'asphalt', toraFt: 14275, ldaFt: 14275,
          ils: { freq: 109.30, ident: 'IDC', course: 301.5, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH30X' } },
        { ident: '12R', paired: '30L', hdgTrue: 121.5, hdgMag: 120.2, lengthFt: 14590, widthFt: 197, lat: 25.25483, lon: 55.36078, elevFt: 11, surface: 'asphalt', toraFt: 14590, ldaFt: 14590,
          ils: { freq: 111.10, ident: 'IDD', course: 121.5, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH48X' } },
        { ident: '30L', paired: '12R', hdgTrue: 301.5, hdgMag: 300.2, lengthFt: 14590, widthFt: 197, lat: 25.23393, lon: 55.39848, elevFt: 60, surface: 'asphalt', toraFt: 14590, ldaFt: 14590,
          ils: { freq: 110.70, ident: 'IDE', course: 301.5, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH44X' } }
      ]
    },
    {
      icao: 'OTHH', iata: 'DOH',
      name: 'Hamad International Airport', nameZh: '多哈哈马德国际机场',
      city: 'Doha', cityZh: '多哈', country: 'Qatar', countryZh: '卡塔尔',
      region: 'middle-east', lat: 25.27306, lon: 51.60806, elevFt: 13, magVar: 1.6, tz: 3,
      transitionAltFt: 13000, size: 'large',
      runways: [
        { ident: '16L', paired: '34R', hdgTrue: 158.2, hdgMag: 156.6, lengthFt: 15912, widthFt: 197, lat: 25.29610, lon: 51.60880, elevFt: 12, surface: 'asphalt', toraFt: 15912, ldaFt: 15912,
          ils: { freq: 110.30, ident: 'IOH', course: 158.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '34R', paired: '16L', hdgTrue: 338.2, hdgMag: 336.6, lengthFt: 15912, widthFt: 197, lat: 25.25540, lon: 51.62680, elevFt: 12, surface: 'asphalt', toraFt: 15912, ldaFt: 15912,
          ils: { freq: 109.30, ident: 'IOI', course: 338.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH30X' } },
        { ident: '16R', paired: '34L', hdgTrue: 158.3, hdgMag: 156.7, lengthFt: 13944, widthFt: 197, lat: 25.29100, lon: 51.58970, elevFt: 12, surface: 'asphalt', toraFt: 13944, ldaFt: 13944,
          ils: { freq: 111.10, ident: 'IOJ', course: 158.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH48X' } },
        { ident: '34L', paired: '16R', hdgTrue: 338.3, hdgMag: 336.7, lengthFt: 13944, widthFt: 197, lat: 25.25530, lon: 51.60540, elevFt: 12, surface: 'asphalt', toraFt: 13944, ldaFt: 13944,
          ils: { freq: 110.70, ident: 'IOK', course: 338.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH44X' } }
      ]
    },
    {
      icao: 'OEJN', iata: 'JED',
      name: 'King Abdulaziz International Airport', nameZh: '吉达阿卜杜勒阿齐兹国王国际机场',
      city: 'Jeddah', cityZh: '吉达', country: 'Saudi Arabia', countryZh: '沙特阿拉伯',
      region: 'middle-east', lat: 21.68024, lon: 39.15744, elevFt: 48, magVar: 2.5, tz: 3,
      transitionAltFt: 13000, size: 'large',
      runways: [
        { ident: '16C', paired: '34C', hdgTrue: 159.9, hdgMag: 157.4, lengthFt: 13123, widthFt: 197, lat: 21.69507, lon: 39.15154, elevFt: 26, surface: 'asphalt', toraFt: 13123, ldaFt: 13123,
          ils: { freq: 111.10, ident: 'IJF', course: 159.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '34C', paired: '16C', hdgTrue: 339.9, hdgMag: 337.4, lengthFt: 13123, widthFt: 197, lat: 21.66118, lon: 39.16492, elevFt: 26, surface: 'asphalt', toraFt: 13123, ldaFt: 13123,
          ils: { freq: 110.70, ident: 'IJG', course: 339.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } },
        { ident: '16L', paired: '34R', hdgTrue: 159.9, hdgMag: 157.4, lengthFt: 13123, widthFt: 197, lat: 21.70044, lon: 39.16713, elevFt: 30, surface: 'asphalt', toraFt: 13123, ldaFt: 13123,
          ils: { freq: 110.30, ident: 'IJD', course: 159.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH40X' } },
        { ident: '34R', paired: '16L', hdgTrue: 339.9, hdgMag: 337.4, lengthFt: 13123, widthFt: 197, lat: 21.66650, lon: 39.18050, elevFt: 48, surface: 'asphalt', toraFt: 13123, ldaFt: 13123,
          ils: { freq: 109.30, ident: 'IJE', course: 339.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } },
        { ident: '16R', paired: '34L', hdgTrue: 159.9, hdgMag: 157.4, lengthFt: 12467, widthFt: 197, lat: 21.70270, lon: 39.12690, elevFt: 13, surface: 'asphalt', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 108.90, ident: 'IJH', course: 159.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '34L', paired: '16R', hdgTrue: 339.9, hdgMag: 337.4, lengthFt: 12467, widthFt: 197, lat: 21.67050, lon: 39.13960, elevFt: 13, surface: 'asphalt', toraFt: 12467, ldaFt: 12467,
          ils: null }
      ]
    },
    {
      icao: 'LLBG', iata: 'TLV',
      name: 'Ben Gurion International Airport', nameZh: '特拉维夫本·古里安国际机场',
      city: 'Tel Aviv', cityZh: '特拉维夫', country: 'Israel', countryZh: '以色列',
      region: 'middle-east', lat: 32.01140, lon: 34.88670, elevFt: 135, magVar: 3.4, tz: 2,
      transitionAltFt: 11000, size: 'large',
      runways: [
        { ident: '03', paired: '21', hdgTrue: 28.7, hdgMag: 25.3, lengthFt: 9094, widthFt: 197, lat: 31.99622, lon: 34.88608, elevFt: 129, surface: 'asphalt', toraFt: 9094, ldaFt: 9094,
          ils: { freq: 111.10, ident: 'ILD', course: 28.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '21', paired: '03', hdgTrue: 208.7, hdgMag: 205.3, lengthFt: 9094, widthFt: 197, lat: 32.01812, lon: 34.90023, elevFt: 134, surface: 'asphalt', toraFt: 9094, ldaFt: 9094,
          ils: { freq: 110.70, ident: 'ILE', course: 208.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } },
        { ident: '08', paired: '26', hdgTrue: 79.7, hdgMag: 76.3, lengthFt: 13327, widthFt: 148, lat: 32.01267, lon: 34.85831, elevFt: 97, surface: 'asphalt', toraFt: 13327, ldaFt: 13327,
          ils: { freq: 110.30, ident: 'ILB', course: 79.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH40X' } },
        { ident: '26', paired: '08', hdgTrue: 259.7, hdgMag: 256.3, lengthFt: 13327, widthFt: 148, lat: 32.01923, lon: 34.90069, elevFt: 124, surface: 'asphalt', toraFt: 13327, ldaFt: 13327,
          ils: { freq: 109.30, ident: 'ILC', course: 259.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } },
        { ident: '12', paired: '30', hdgTrue: 121.6, hdgMag: 118.2, lengthFt: 10209, widthFt: 148, lat: 32.01470, lon: 34.86580, elevFt: 112, surface: 'asphalt', toraFt: 10209, ldaFt: 10209,
          ils: { freq: 108.90, ident: 'ILF', course: 121.6, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '30', paired: '12', hdgTrue: 301.6, hdgMag: 298.2, lengthFt: 10209, widthFt: 148, lat: 31.99990, lon: 34.89420, elevFt: 130, surface: 'asphalt', toraFt: 10209, ldaFt: 10209,
          ils: { freq: 109.90, ident: 'ILG', course: 301.6, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH36X' } }
      ]
    },
    /* ------------------------- 欧洲 Europe ------------------------- */
    {
      icao: 'EGLL', iata: 'LHR',
      name: 'London Heathrow Airport', nameZh: '伦敦希思罗机场',
      city: 'London', cityZh: '伦敦', country: 'United Kingdom', countryZh: '英国',
      region: 'europe', lat: 51.47075, lon: -0.45991, elevFt: 83, magVar: -2.2, tz: 0,
      transitionAltFt: 6000, size: 'large',
      runways: [
        { ident: '09L', paired: '27R', hdgTrue: 89.7, hdgMag: 91.9, lengthFt: 12799, widthFt: 164, lat: 51.47749, lon: -0.48944, elevFt: 79, surface: 'asphalt', toraFt: 12799, ldaFt: 12799,
          ils: { freq: 110.30, ident: 'ILL', course: 89.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '27R', paired: '09L', hdgTrue: 269.7, hdgMag: 271.9, lengthFt: 12799, widthFt: 164, lat: 51.47768, lon: -0.43323, elevFt: 78, surface: 'asphalt', toraFt: 12799, ldaFt: 12799,
          ils: { freq: 109.50, ident: 'ILR', course: 269.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH32X' } },
        { ident: '09R', paired: '27L', hdgTrue: 89.7, hdgMag: 91.9, lengthFt: 12001, widthFt: 164, lat: 51.46478, lon: -0.48681, elevFt: 75, surface: 'asphalt', toraFt: 12001, ldaFt: 12001,
          ils: { freq: 110.90, ident: 'IRL', course: 89.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH46X' } },
        { ident: '27L', paired: '09R', hdgTrue: 269.7, hdgMag: 271.9, lengthFt: 12001, widthFt: 164, lat: 51.46496, lon: -0.43405, elevFt: 77, surface: 'asphalt', toraFt: 12001, ldaFt: 12001,
          ils: { freq: 111.10, ident: 'IRM', course: 269.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH48X' } }
      ]
    },
    {
      icao: 'LFPG', iata: 'CDG',
      name: 'Paris Charles de Gaulle Airport', nameZh: '巴黎夏尔·戴高乐机场',
      city: 'Paris', cityZh: '巴黎', country: 'France', countryZh: '法国',
      region: 'europe', lat: 49.00896, lon: 2.55412, elevFt: 392, magVar: -1.0, tz: 1,
      transitionAltFt: 5000, size: 'large',
      runways: [
        { ident: '08L', paired: '26R', hdgTrue: 79.0, hdgMag: 80.0, lengthFt: 13829, widthFt: 148, lat: 48.99363, lon: 2.55310, elevFt: 338, surface: 'asphalt', toraFt: 13829, ldaFt: 13829,
          ils: { freq: 110.30, ident: 'IPG', course: 79.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '26R', paired: '08L', hdgTrue: 259.0, hdgMag: 260.0, lengthFt: 13829, widthFt: 148, lat: 49.00086, lon: 2.60982, elevFt: 318, surface: 'asphalt', toraFt: 13829, ldaFt: 13829,
          ils: { freq: 109.30, ident: 'IPH', course: 259.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH30X' } },
        { ident: '08R', paired: '26L', hdgTrue: 79.0, hdgMag: 80.0, lengthFt: 8858, widthFt: 197, lat: 48.99158, lon: 2.56588, elevFt: 336, surface: 'concrete', toraFt: 8858, ldaFt: 8858,
          ils: { freq: 111.10, ident: 'IPI', course: 79.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH48X' } },
        { ident: '26L', paired: '08R', hdgTrue: 259.0, hdgMag: 260.0, lengthFt: 8858, widthFt: 197, lat: 48.99622, lon: 2.60221, elevFt: 316, surface: 'concrete', toraFt: 8858, ldaFt: 8858,
          ils: { freq: 110.70, ident: 'IPJ', course: 259.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH44X' } },
        { ident: '09L', paired: '27R', hdgTrue: 85.3, hdgMag: 86.3, lengthFt: 8858, widthFt: 197, lat: 49.02470, lon: 2.52489, elevFt: 378, surface: 'asphalt', toraFt: 8858, ldaFt: 8858,
          ils: { freq: 108.90, ident: 'IPK', course: 85.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '27R', paired: '09L', hdgTrue: 265.3, hdgMag: 266.3, lengthFt: 8858, widthFt: 197, lat: 49.02670, lon: 2.56169, elevFt: 392, surface: 'asphalt', toraFt: 8858, ldaFt: 8858,
          ils: { freq: 109.90, ident: 'IPL', course: 265.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH36X' } },
        { ident: '09R', paired: '27L', hdgTrue: 85.3, hdgMag: 86.3, lengthFt: 13780, widthFt: 148, lat: 49.02060, lon: 2.51306, elevFt: 370, surface: 'asphalt', toraFt: 13780, ldaFt: 13780,
          ils: { freq: 111.70, ident: 'IPM', course: 85.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH54X' } },
        { ident: '27L', paired: '09R', hdgTrue: 265.3, hdgMag: 266.3, lengthFt: 13780, widthFt: 148, lat: 49.02370, lon: 2.57029, elevFt: 387, surface: 'asphalt', toraFt: 13780, ldaFt: 13780,
          ils: { freq: 111.90, ident: 'IPN', course: 265.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH56X' } }
      ]
    },
    {
      icao: 'EDDF', iata: 'FRA',
      name: 'Frankfurt Airport', nameZh: '法兰克福机场',
      city: 'Frankfurt', cityZh: '法兰克福', country: 'Germany', countryZh: '德国',
      region: 'europe', lat: 50.02671, lon: 8.55835, elevFt: 364, magVar: 0.5, tz: 1,
      transitionAltFt: 5000, size: 'large',
      runways: [
        { ident: '07C', paired: '25C', hdgTrue: 69.6, hdgMag: 69.1, lengthFt: 13123, widthFt: 197, lat: 50.03260, lon: 8.53463, elevFt: 329, surface: 'asphalt', toraFt: 13123, ldaFt: 13123,
          ils: { freq: 110.30, ident: 'IFC', course: 69.6, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '25C', paired: '07C', hdgTrue: 249.6, hdgMag: 249.1, lengthFt: 13123, widthFt: 197, lat: 50.04510, lon: 8.58698, elevFt: 364, surface: 'asphalt', toraFt: 13123, ldaFt: 13123,
          ils: { freq: 109.30, ident: 'IFD', course: 249.6, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH30X' } },
        { ident: '07L', paired: '25R', hdgTrue: 69.7, hdgMag: 69.2, lengthFt: 9186, widthFt: 148, lat: 50.03710, lon: 8.49708, elevFt: 305, surface: 'concrete', toraFt: 9186, ldaFt: 9186,
          ils: { freq: 108.90, ident: 'IFG', course: 69.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '25R', paired: '07L', hdgTrue: 249.7, hdgMag: 249.2, lengthFt: 9186, widthFt: 148, lat: 50.04580, lon: 8.53372, elevFt: 353, surface: 'concrete', toraFt: 9186, ldaFt: 9186,
          ils: { freq: 109.90, ident: 'IFH', course: 249.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH36X' } },
        { ident: '07R', paired: '25L', hdgTrue: 69.4, hdgMag: 68.9, lengthFt: 13123, widthFt: 148, lat: 50.02750, lon: 8.53417, elevFt: 328, surface: 'concrete', toraFt: 13123, ldaFt: 13123,
          ils: { freq: 111.10, ident: 'IFE', course: 69.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH48X' } },
        { ident: '25L', paired: '07R', hdgTrue: 249.4, hdgMag: 248.9, lengthFt: 13123, widthFt: 148, lat: 50.04010, lon: 8.58653, elevFt: 362, surface: 'concrete', toraFt: 13123, ldaFt: 13123,
          ils: { freq: 110.70, ident: 'IFF', course: 249.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH44X' } },
        { ident: '18', paired: '36', hdgTrue: 179.6, hdgMag: 179.1, lengthFt: 13123, widthFt: 148, lat: 50.03415, lon: 8.52594, elevFt: 326, surface: 'concrete', toraFt: 13123, ldaFt: 13123,
          ils: { freq: 111.70, ident: 'IFI', course: 179.6, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH54X' } },
        { ident: '36', paired: '18', hdgTrue: 359.6, hdgMag: 359.1, lengthFt: 13123, widthFt: 148, lat: 49.99849, lon: 8.52630, elevFt: 316, surface: 'concrete', toraFt: 13123, ldaFt: 13123,
          ils: null }
      ]
    },
    {
      icao: 'EHAM', iata: 'AMS',
      name: 'Amsterdam Airport Schiphol', nameZh: '阿姆斯特丹史基浦机场',
      city: 'Amsterdam', cityZh: '阿姆斯特丹', country: 'Netherlands', countryZh: '荷兰',
      region: 'europe', lat: 52.30860, lon: 4.76389, elevFt: -11, magVar: -0.4, tz: 1,
      transitionAltFt: 3000, size: 'large',
      runways: [
        { ident: '04', paired: '22', hdgTrue: 41.3, hdgMag: 41.7, lengthFt: 6627, widthFt: 148, lat: 52.30040, lon: 4.78348, elevFt: -13, surface: 'asphalt', toraFt: 6627, ldaFt: 6627,
          ils: null },
        { ident: '22', paired: '04', hdgTrue: 221.3, hdgMag: 221.7, lengthFt: 6627, widthFt: 148, lat: 52.31400, lon: 4.80302, elevFt: -14, surface: 'asphalt', toraFt: 6627, ldaFt: 6627,
          ils: { freq: 108.30, ident: 'IAJ', course: 221.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH20X' } },
        { ident: '06', paired: '24', hdgTrue: 57.9, hdgMag: 58.3, lengthFt: 11283, widthFt: 148, lat: 52.28790, lon: 4.73402, elevFt: -11, surface: 'asphalt', toraFt: 11283, ldaFt: 11283,
          ils: { freq: 111.70, ident: 'IAG', course: 57.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH54X' } },
        { ident: '24', paired: '06', hdgTrue: 237.9, hdgMag: 238.3, lengthFt: 11283, widthFt: 148, lat: 52.30460, lon: 4.77752, elevFt: -12, surface: 'asphalt', toraFt: 11283, ldaFt: 11283,
          ils: { freq: 111.90, ident: 'IAH', course: 237.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH56X' } },
        { ident: '09', paired: '27', hdgTrue: 86.6, hdgMag: 87.0, lengthFt: 11329, widthFt: 148, lat: 52.31660, lon: 4.74635, elevFt: -12, surface: 'asphalt', toraFt: 11329, ldaFt: 11329,
          ils: { freq: 108.90, ident: 'IAE', course: 86.6, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '27', paired: '09', hdgTrue: 266.6, hdgMag: 267.0, lengthFt: 11329, widthFt: 148, lat: 52.31840, lon: 4.79689, elevFt: -13, surface: 'asphalt', toraFt: 11329, ldaFt: 11329,
          ils: { freq: 109.90, ident: 'IAF', course: 266.6, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH36X' } },
        { ident: '18C', paired: '36C', hdgTrue: 183.0, hdgMag: 183.4, lengthFt: 10826, widthFt: 148, lat: 52.33140, lon: 4.74003, elevFt: -13, surface: 'asphalt', toraFt: 10826, ldaFt: 10826,
          ils: { freq: 111.10, ident: 'IAC', course: 183.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH48X' } },
        { ident: '36C', paired: '18C', hdgTrue: 3.0, hdgMag: 3.4, lengthFt: 10826, widthFt: 148, lat: 52.30180, lon: 4.73750, elevFt: -12, surface: 'asphalt', toraFt: 10826, ldaFt: 10826,
          ils: { freq: 110.70, ident: 'IAD', course: 3.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH44X' } },
        { ident: '18L', paired: '36R', hdgTrue: 183.0, hdgMag: 183.4, lengthFt: 11155, widthFt: 148, lat: 52.32130, lon: 4.77996, elevFt: -12, surface: 'asphalt', toraFt: 11155, ldaFt: 11155,
          ils: { freq: 111.30, ident: 'IAK', course: 183.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH50X' } },
        { ident: '36R', paired: '18L', hdgTrue: 3.0, hdgMag: 3.4, lengthFt: 11155, widthFt: 148, lat: 52.29080, lon: 4.77735, elevFt: -11, surface: 'asphalt', toraFt: 11155, ldaFt: 11155,
          ils: { freq: 108.15, ident: 'IAM', course: 3.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH18Y' } },
        { ident: '18R', paired: '36L', hdgTrue: 183.2, hdgMag: 183.6, lengthFt: 12467, widthFt: 198, lat: 52.36270, lon: 4.71193, elevFt: -13, surface: 'asphalt', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 110.30, ident: 'IAR', course: 183.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '36L', paired: '18R', hdgTrue: 3.2, hdgMag: 3.6, lengthFt: 12467, widthFt: 198, lat: 52.32860, lon: 4.70884, elevFt: -12, surface: 'asphalt', toraFt: 12467, ldaFt: 12467,
          ils: { freq: 109.30, ident: 'IAS', course: 3.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH30X' } }
      ]
    },
    {
      icao: 'LEMD', iata: 'MAD',
      name: 'Adolfo Suarez Madrid-Barajas Airport', nameZh: '马德里巴拉哈斯机场',
      city: 'Madrid', cityZh: '马德里', country: 'Spain', countryZh: '西班牙',
      region: 'europe', lat: 40.49341, lon: -3.57225, elevFt: 1998, magVar: -2.1, tz: 1,
      transitionAltFt: 6000, size: 'large',
      runways: [
        { ident: '14L', paired: '32R', hdgTrue: 142.3, hdgMag: 144.4, lengthFt: 11483, widthFt: 197, lat: 40.49490, lon: -3.55787, elevFt: 1942, surface: 'asphalt', toraFt: 11483, ldaFt: 11483,
          ils: { freq: 110.70, ident: 'IMG', course: 142.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH44X' } },
        { ident: '32R', paired: '14L', hdgTrue: 322.3, hdgMag: 324.4, lengthFt: 11483, widthFt: 197, lat: 40.47000, lon: -3.53258, elevFt: 1876, surface: 'asphalt', toraFt: 11483, ldaFt: 11483,
          ils: { freq: 111.10, ident: 'IMF', course: 322.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH48X' } },
        { ident: '14R', paired: '32L', hdgTrue: 142.3, hdgMag: 144.4, lengthFt: 13084, widthFt: 197, lat: 40.48490, lon: -3.57601, elevFt: 1995, surface: 'asphalt', toraFt: 13084, ldaFt: 13084,
          ils: { freq: 109.30, ident: 'IME', course: 142.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH30X' } },
        { ident: '32L', paired: '14R', hdgTrue: 322.3, hdgMag: 324.4, lengthFt: 13084, widthFt: 197, lat: 40.45570, lon: -3.54638, elevFt: 1909, surface: 'asphalt', toraFt: 13084, ldaFt: 13084,
          ils: { freq: 110.30, ident: 'IMD', course: 322.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '18L', paired: '36R', hdgTrue: 179.8, hdgMag: 181.9, lengthFt: 11483, widthFt: 197, lat: 40.53260, lon: -3.55938, elevFt: 1919, surface: 'asphalt', toraFt: 11483, ldaFt: 11483,
          ils: { freq: 111.70, ident: 'IMJ', course: 179.8, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH54X' } },
        { ident: '36R', paired: '18L', hdgTrue: 359.8, hdgMag: 1.9, lengthFt: 11483, widthFt: 197, lat: 40.50110, lon: -3.55921, elevFt: 1942, surface: 'asphalt', toraFt: 11483, ldaFt: 11483,
          ils: null },
        { ident: '18R', paired: '36L', hdgTrue: 179.8, hdgMag: 181.9, lengthFt: 14271, widthFt: 197, lat: 40.53180, lon: -3.57485, elevFt: 1998, surface: 'asphalt', toraFt: 14271, ldaFt: 14271,
          ils: { freq: 108.90, ident: 'IMH', course: 179.8, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '36L', paired: '18R', hdgTrue: 359.8, hdgMag: 1.9, lengthFt: 14271, widthFt: 197, lat: 40.49260, lon: -3.57463, elevFt: 1985, surface: 'asphalt', toraFt: 14271, ldaFt: 14271,
          ils: { freq: 109.90, ident: 'IMI', course: 359.8, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH36X' } }
      ]
    },
    {
      icao: 'LIRF', iata: 'FCO',
      name: 'Rome Fiumicino Leonardo da Vinci International Airport', nameZh: '罗马菲乌米奇诺国际机场',
      city: 'Rome', cityZh: '罗马', country: 'Italy', countryZh: '意大利',
      region: 'europe', lat: 41.80453, lon: 12.25200, elevFt: 13, magVar: 1.4, tz: 1,
      transitionAltFt: 6000, size: 'large',
      runways: [
        { ident: '07', paired: '25', hdgTrue: 69.7, hdgMag: 68.3, lengthFt: 10826, widthFt: 147, lat: 41.79933, lon: 12.23214, elevFt: 7, surface: 'asphalt', toraFt: 10826, ldaFt: 10826,
          ils: { freq: 108.90, ident: 'IFS', course: 69.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '25', paired: '07', hdgTrue: 249.7, hdgMag: 248.3, lengthFt: 10826, widthFt: 147, lat: 41.80963, lon: 12.26948, elevFt: 5, surface: 'asphalt', toraFt: 10826, ldaFt: 10826,
          ils: { freq: 109.90, ident: 'IFT', course: 249.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH36X' } },
        { ident: '16L', paired: '34R', hdgTrue: 162.7, hdgMag: 161.3, lengthFt: 12801, widthFt: 196, lat: 41.84600, lon: 12.26150, elevFt: 14, surface: 'asphalt', toraFt: 12801, ldaFt: 12801,
          ils: { freq: 110.30, ident: 'IFO', course: 162.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '34R', paired: '16L', hdgTrue: 342.7, hdgMag: 341.3, lengthFt: 12801, widthFt: 196, lat: 41.81240, lon: 12.27550, elevFt: 6, surface: 'asphalt', toraFt: 12801, ldaFt: 12801,
          ils: { freq: 109.30, ident: 'IFP', course: 342.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } },
        { ident: '16R', paired: '34L', hdgTrue: 162.7, hdgMag: 161.3, lengthFt: 12801, widthFt: 196, lat: 41.81550, lon: 12.22640, elevFt: 7, surface: 'asphalt', toraFt: 12801, ldaFt: 12801,
          ils: { freq: 111.10, ident: 'IFQ', course: 162.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH48X' } },
        { ident: '34L', paired: '16R', hdgTrue: 342.7, hdgMag: 341.3, lengthFt: 12801, widthFt: 196, lat: 41.78200, lon: 12.24040, elevFt: 8, surface: 'asphalt', toraFt: 12801, ldaFt: 12801,
          ils: { freq: 110.70, ident: 'IFR', course: 342.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } }
      ]
    },
    {
      icao: 'LSZH', iata: 'ZRH',
      name: 'Zurich Airport', nameZh: '苏黎世机场',
      city: 'Zurich', cityZh: '苏黎世', country: 'Switzerland', countryZh: '瑞士',
      region: 'europe', lat: 47.45806, lon: 8.54806, elevFt: 1417, magVar: 0.5, tz: 1,
      transitionAltFt: 7000, size: 'large',
      runways: [
        { ident: '10', paired: '28', hdgTrue: 95.9, hdgMag: 95.4, lengthFt: 8202, widthFt: 197, lat: 47.45890, lon: 8.53747, elevFt: 1391, surface: 'concrete', toraFt: 8202, ldaFt: 8202,
          ils: { freq: 108.90, ident: 'IZL', course: 95.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '28', paired: '10', hdgTrue: 275.9, hdgMag: 275.4, lengthFt: 8202, widthFt: 197, lat: 47.45660, lon: 8.57045, elevFt: 1416, surface: 'concrete', toraFt: 8202, ldaFt: 8202,
          ils: { freq: 109.90, ident: 'IZM', course: 275.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH36X' } },
        { ident: '14', paired: '32', hdgTrue: 137.3, hdgMag: 136.8, lengthFt: 10827, widthFt: 197, lat: 47.48310, lon: 8.53473, elevFt: 1402, surface: 'concrete', toraFt: 10827, ldaFt: 10827,
          ils: { freq: 111.10, ident: 'IZJ', course: 137.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '32', paired: '14', hdgTrue: 317.3, hdgMag: 316.8, lengthFt: 10827, widthFt: 197, lat: 47.46130, lon: 8.56446, elevFt: 1402, surface: 'concrete', toraFt: 10827, ldaFt: 10827,
          ils: { freq: 110.70, ident: 'IZK', course: 317.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } },
        { ident: '16', paired: '34', hdgTrue: 155.0, hdgMag: 154.5, lengthFt: 12139, widthFt: 197, lat: 47.47560, lon: 8.53595, elevFt: 1390, surface: 'concrete', toraFt: 12139, ldaFt: 12139,
          ils: { freq: 110.30, ident: 'IZH', course: 155.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '34', paired: '16', hdgTrue: 335.0, hdgMag: 334.5, lengthFt: 12139, widthFt: 197, lat: 47.44540, lon: 8.55673, elevFt: 1388, surface: 'concrete', toraFt: 12139, ldaFt: 12139,
          ils: { freq: 109.30, ident: 'IZI', course: 335.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } }
      ]
    },
    {
      icao: 'LOWW', iata: 'VIE',
      name: 'Vienna International Airport', nameZh: '维也纳国际机场',
      city: 'Vienna', cityZh: '维也纳', country: 'Austria', countryZh: '奥地利',
      region: 'europe', lat: 48.11030, lon: 16.56970, elevFt: 600, magVar: 2.5, tz: 1,
      transitionAltFt: 5000, size: 'large',
      runways: [
        { ident: '11', paired: '29', hdgTrue: 116.1, hdgMag: 113.6, lengthFt: 11483, widthFt: 148, lat: 48.12280, lon: 16.53340, elevFt: 575, surface: 'asphalt', toraFt: 11483, ldaFt: 11483,
          ils: { freq: 110.30, ident: 'IWW', course: 116.1, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '29', paired: '11', hdgTrue: 296.1, hdgMag: 293.6, lengthFt: 11483, widthFt: 148, lat: 48.10900, lon: 16.57560, elevFt: 600, surface: 'asphalt', toraFt: 11483, ldaFt: 11483,
          ils: { freq: 109.30, ident: 'IWX', course: 296.1, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH30X' } },
        { ident: '16', paired: '34', hdgTrue: 164.3, hdgMag: 161.8, lengthFt: 11811, widthFt: 148, lat: 48.11980, lon: 16.57820, elevFt: 597, surface: 'asphalt', toraFt: 11811, ldaFt: 11811,
          ils: { freq: 111.10, ident: 'IWY', course: 164.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '34', paired: '16', hdgTrue: 344.3, hdgMag: 341.8, lengthFt: 11811, widthFt: 148, lat: 48.08860, lon: 16.59130, elevFt: 586, surface: 'asphalt', toraFt: 11811, ldaFt: 11811,
          ils: { freq: 110.70, ident: 'IWZ', course: 344.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } }
      ]
    },
    {
      icao: 'EKCH', iata: 'CPH',
      name: 'Copenhagen Airport', nameZh: '哥本哈根凯斯楚普机场',
      city: 'Copenhagen', cityZh: '哥本哈根', country: 'Denmark', countryZh: '丹麦',
      region: 'europe', lat: 55.61790, lon: 12.65600, elevFt: 17, magVar: 1.6, tz: 1,
      transitionAltFt: 5000, size: 'large',
      runways: [
        { ident: '04L', paired: '22R', hdgTrue: 41.1, hdgMag: 39.5, lengthFt: 11811, widthFt: 148, lat: 55.59220, lon: 12.60354, elevFt: 13, surface: 'asphalt', toraFt: 11811, ldaFt: 11811,
          ils: { freq: 110.30, ident: 'IKH', course: 41.1, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '22R', paired: '04L', hdgTrue: 221.1, hdgMag: 219.5, lengthFt: 11811, widthFt: 148, lat: 55.61654, lon: 12.64117, elevFt: 14, surface: 'asphalt', toraFt: 11811, ldaFt: 11811,
          ils: { freq: 109.30, ident: 'IKI', course: 221.1, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } },
        { ident: '04R', paired: '22L', hdgTrue: 41.2, hdgMag: 39.6, lengthFt: 10827, widthFt: 148, lat: 55.60310, lon: 12.63300, elevFt: 12, surface: 'asphalt', toraFt: 10827, ldaFt: 10827,
          ils: { freq: 111.10, ident: 'IKJ', course: 41.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '22L', paired: '04R', hdgTrue: 221.2, hdgMag: 219.6, lengthFt: 10827, widthFt: 148, lat: 55.62540, lon: 12.66760, elevFt: 8, surface: 'asphalt', toraFt: 10827, ldaFt: 10827,
          ils: { freq: 110.70, ident: 'IKK', course: 221.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } },
        { ident: '12', paired: '30', hdgTrue: 123.2, hdgMag: 121.6, lengthFt: 9186, widthFt: 148, lat: 55.62629, lon: 12.63333, elevFt: 13, surface: 'asphalt', toraFt: 9186, ldaFt: 9186,
          ils: { freq: 108.90, ident: 'IKL', course: 123.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '30', paired: '12', hdgTrue: 303.2, hdgMag: 301.6, lengthFt: 9186, widthFt: 148, lat: 55.61252, lon: 12.67053, elevFt: 8, surface: 'asphalt', toraFt: 9186, ldaFt: 9186,
          ils: { freq: 109.90, ident: 'IKN', course: 303.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH36X' } }
      ]
    },
    {
      icao: 'ESSA', iata: 'ARN',
      name: 'Stockholm Arlanda Airport', nameZh: '斯德哥尔摩阿兰达机场',
      city: 'Stockholm', cityZh: '斯德哥尔摩', country: 'Sweden', countryZh: '瑞典',
      region: 'europe', lat: 59.64849, lon: 17.92883, elevFt: 137, magVar: 4.1, tz: 1,
      transitionAltFt: 5000, size: 'large',
      runways: [
        { ident: '01L', paired: '19R', hdgTrue: 10.4, hdgMag: 6.3, lengthFt: 10830, widthFt: 148, lat: 59.63730, lon: 17.91320, elevFt: 98, surface: 'asphalt', toraFt: 10830, ldaFt: 10830,
          ils: { freq: 110.30, ident: 'IAN', course: 10.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '19R', paired: '01L', hdgTrue: 190.4, hdgMag: 186.3, lengthFt: 10830, widthFt: 148, lat: 59.66640, lon: 17.92380, elevFt: 118, surface: 'asphalt', toraFt: 10830, ldaFt: 10830,
          ils: { freq: 109.30, ident: 'IAO', course: 190.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } },
        { ident: '01R', paired: '19L', hdgTrue: 10.4, hdgMag: 6.3, lengthFt: 8201, widthFt: 148, lat: 59.62640, lon: 17.95070, elevFt: 137, surface: 'asphalt', toraFt: 8201, ldaFt: 8201,
          ils: { freq: 111.10, ident: 'IAP', course: 10.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '19L', paired: '01R', hdgTrue: 190.4, hdgMag: 186.3, lengthFt: 8201, widthFt: 148, lat: 59.64850, lon: 17.95870, elevFt: 98, surface: 'asphalt', toraFt: 8201, ldaFt: 8201,
          ils: { freq: 110.70, ident: 'IAQ', course: 190.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } },
        { ident: '08', paired: '26', hdgTrue: 84.1, hdgMag: 80.0, lengthFt: 8202, widthFt: 148, lat: 59.65999, lon: 17.93551, elevFt: 108, surface: 'asphalt', toraFt: 8202, ldaFt: 8202,
          ils: { freq: 108.90, ident: 'IAT', course: 84.1, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '26', paired: '08', hdgTrue: 264.1, hdgMag: 260.0, lengthFt: 8202, widthFt: 148, lat: 59.66230, lon: 17.97979, elevFt: 124, surface: 'asphalt', toraFt: 8202, ldaFt: 8202,
          ils: { freq: 109.90, ident: 'IAU', course: 264.1, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH36X' } }
      ]
    },
    {
      icao: 'UUEE', iata: 'SVO',
      name: 'Sheremetyevo International Airport', nameZh: '莫斯科谢列梅捷沃国际机场',
      city: 'Moscow', cityZh: '莫斯科', country: 'Russia', countryZh: '俄罗斯',
      region: 'europe', lat: 55.97686, lon: 37.41121, elevFt: 622, magVar: 9.4, tz: 3,
      transitionAltFt: 10000, size: 'large',
      runways: [
        { ident: '06C', paired: '24C', hdgTrue: 64.0, hdgMag: 54.6, lengthFt: 11647, widthFt: 197, lat: 55.96690, lon: 37.38856, elevFt: 620, surface: 'concrete', toraFt: 11647, ldaFt: 11647,
          ils: { freq: 110.30, ident: 'ISV', course: 64.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '24C', paired: '06C', hdgTrue: 244.0, hdgMag: 234.6, lengthFt: 11647, widthFt: 197, lat: 55.98090, lon: 37.43984, elevFt: 622, surface: 'concrete', toraFt: 11647, ldaFt: 11647,
          ils: { freq: 109.30, ident: 'ISW', course: 244.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } },
        { ident: '06L', paired: '24R', hdgTrue: 64.0, hdgMag: 54.6, lengthFt: 10499, widthFt: 197, lat: 55.97839, lon: 37.33059, elevFt: 600, surface: 'concrete', toraFt: 10499, ldaFt: 10499,
          ils: { freq: 111.10, ident: 'ISX', course: 64.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '24R', paired: '06L', hdgTrue: 244.0, hdgMag: 234.6, lengthFt: 10499, widthFt: 197, lat: 55.99101, lon: 37.37682, elevFt: 589, surface: 'concrete', toraFt: 10499, ldaFt: 10499,
          ils: { freq: 110.70, ident: 'ISG', course: 244.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } },
        { ident: '06R', paired: '24L', hdgTrue: 64.0, hdgMag: 54.6, lengthFt: 12139, widthFt: 197, lat: 55.96410, lon: 37.38828, elevFt: 619, surface: 'concrete', toraFt: 12139, ldaFt: 12139,
          ils: { freq: 108.90, ident: 'ISB', course: 64.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '24L', paired: '06R', hdgTrue: 244.0, hdgMag: 234.6, lengthFt: 12139, widthFt: 197, lat: 55.97869, lon: 37.44173, elevFt: 621, surface: 'concrete', toraFt: 12139, ldaFt: 12139,
          ils: { freq: 109.90, ident: 'ITN', course: 244.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH36X' } }
      ]
    },
    {
      icao: 'LTFM', iata: 'IST',
      name: 'Istanbul Airport', nameZh: '伊斯坦布尔机场',
      city: 'Istanbul', cityZh: '伊斯坦布尔', country: 'Turkey', countryZh: '土耳其',
      region: 'europe', lat: 41.27487, lon: 28.73214, elevFt: 325, magVar: 4.2, tz: 3,
      transitionAltFt: 12000, size: 'large',
      runways: [
        { ident: '09', paired: '27', hdgTrue: 89.2, hdgMag: 85.0, lengthFt: 9250, widthFt: 148, lat: 41.25369, lon: 28.76627, elevFt: 274, surface: 'concrete', toraFt: 9250, ldaFt: 9250,
          ils: { freq: 110.50, ident: 'IIJ', course: 89.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH42X' } },
        { ident: '27', paired: '09', hdgTrue: 269.2, hdgMag: 265.0, lengthFt: 9250, widthFt: 148, lat: 41.25406, lon: 28.80002, elevFt: 274, surface: 'concrete', toraFt: 9250, ldaFt: 9250,
          ils: null },
        { ident: '16L', paired: '34R', hdgTrue: 164.2, hdgMag: 160.0, lengthFt: 12303, widthFt: 147, lat: 41.29797, lon: 28.70344, elevFt: 218, surface: 'asphalt', toraFt: 12303, ldaFt: 12303,
          ils: { freq: 108.90, ident: 'IIE', course: 164.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '34R', paired: '16L', hdgTrue: 344.2, hdgMag: 340.0, lengthFt: 12303, widthFt: 147, lat: 41.26552, lon: 28.71566, elevFt: 325, surface: 'asphalt', toraFt: 12303, ldaFt: 12303,
          ils: { freq: 109.90, ident: 'IIF', course: 344.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH36X' } },
        { ident: '16R', paired: '34L', hdgTrue: 164.2, hdgMag: 160.0, lengthFt: 12303, widthFt: 196, lat: 41.29794, lon: 28.70097, elevFt: 218, surface: 'asphalt', toraFt: 12303, ldaFt: 12303,
          ils: { freq: 111.70, ident: 'IIG', course: 164.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH54X' } },
        { ident: '34L', paired: '16R', hdgTrue: 344.2, hdgMag: 340.0, lengthFt: 12303, widthFt: 196, lat: 41.26549, lon: 28.71319, elevFt: 325, surface: 'asphalt', toraFt: 12303, ldaFt: 12303,
          ils: { freq: 111.90, ident: 'IIH', course: 344.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH56X' } },
        { ident: '17L', paired: '35R', hdgTrue: 179.2, hdgMag: 175.0, lengthFt: 13451, widthFt: 196, lat: 41.29883, lon: 28.72704, elevFt: 202, surface: 'asphalt', toraFt: 13451, ldaFt: 13451,
          ils: { freq: 110.30, ident: 'IIA', course: 179.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '35R', paired: '17L', hdgTrue: 359.2, hdgMag: 355.0, lengthFt: 13451, widthFt: 196, lat: 41.26192, lon: 28.72776, elevFt: 310, surface: 'asphalt', toraFt: 13451, ldaFt: 13451,
          ils: { freq: 109.30, ident: 'IIB', course: 359.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH30X' } },
        { ident: '17R', paired: '35L', hdgTrue: 179.1, hdgMag: 174.9, lengthFt: 13451, widthFt: 147, lat: 41.29880, lon: 28.72450, elevFt: 202, surface: 'asphalt', toraFt: 13451, ldaFt: 13451,
          ils: { freq: 111.10, ident: 'IIC', course: 179.1, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH48X' } },
        { ident: '35L', paired: '17R', hdgTrue: 359.1, hdgMag: 354.9, lengthFt: 13451, widthFt: 147, lat: 41.26190, lon: 28.72530, elevFt: 310, surface: 'asphalt', toraFt: 13451, ldaFt: 13451,
          ils: { freq: 110.70, ident: 'IID', course: 359.1, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } },
        { ident: '18', paired: '36', hdgTrue: 179.2, hdgMag: 175.0, lengthFt: 10039, widthFt: 148, lat: 41.28980, lon: 28.75620, elevFt: 221, surface: 'concrete', toraFt: 10039, ldaFt: 10039,
          ils: { freq: 108.10, ident: 'III', course: 179.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH18X' } },
        { ident: '36', paired: '18', hdgTrue: 359.2, hdgMag: 355.0, lengthFt: 10039, widthFt: 148, lat: 41.26220, lon: 28.75670, elevFt: 309, surface: 'concrete', toraFt: 10039, ldaFt: 10039,
          ils: null }
      ]
    },
    /* ------------------------- 北美洲 North America ------------------------- */
    {
      icao: 'KJFK', iata: 'JFK',
      name: 'John F. Kennedy International Airport', nameZh: '纽约肯尼迪国际机场',
      city: 'New York', cityZh: '纽约', country: 'United States', countryZh: '美国',
      region: 'north-america', lat: 40.63945, lon: -73.77932, elevFt: 13, magVar: -13.2, tz: -5,
      transitionAltFt: 18000, size: 'large',
      runways: [
        { ident: '04L', paired: '22R', hdgTrue: 30.6, hdgMag: 43.8, lengthFt: 12079, widthFt: 200, lat: 40.62115, lon: -73.78626, elevFt: 12, surface: 'concrete', toraFt: 12079, ldaFt: 12079,
          ils: { freq: 108.90, ident: 'IJFO', course: 30.6, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '22R', paired: '04L', hdgTrue: 210.6, hdgMag: 223.8, lengthFt: 12079, widthFt: 200, lat: 40.64965, lon: -73.76404, elevFt: 13, surface: 'concrete', toraFt: 12079, ldaFt: 12079,
          ils: { freq: 110.70, ident: 'IJFP', course: 210.6, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } },
        { ident: '04R', paired: '22L', hdgTrue: 30.6, hdgMag: 43.8, lengthFt: 8400, widthFt: 200, lat: 40.62540, lon: -73.77030, elevFt: 13, surface: 'asphalt', toraFt: 8400, ldaFt: 8400,
          ils: { freq: 110.90, ident: 'IJFK', course: 30.6, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH46X' } },
        { ident: '22L', paired: '04R', hdgTrue: 210.6, hdgMag: 223.8, lengthFt: 8400, widthFt: 200, lat: 40.64520, lon: -73.75490, elevFt: 13, surface: 'asphalt', toraFt: 8400, ldaFt: 8400,
          ils: { freq: 110.30, ident: 'IJFL', course: 210.6, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH40X' } },
        { ident: '13L', paired: '31R', hdgTrue: 121.0, hdgMag: 134.2, lengthFt: 10000, widthFt: 200, lat: 40.65780, lon: -73.79020, elevFt: 13, surface: 'concrete', toraFt: 10000, ldaFt: 10000,
          ils: { freq: 111.10, ident: 'IJFM', course: 121.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH48X' } },
        { ident: '31R', paired: '13L', hdgTrue: 301.0, hdgMag: 314.2, lengthFt: 10000, widthFt: 200, lat: 40.64370, lon: -73.75930, elevFt: 13, surface: 'concrete', toraFt: 10000, ldaFt: 10000,
          ils: { freq: 109.90, ident: 'IJFN', course: 301.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH36X' } },
        { ident: '13R', paired: '31L', hdgTrue: 120.9, hdgMag: 134.1, lengthFt: 14511, widthFt: 200, lat: 40.64840, lon: -73.81670, elevFt: 13, surface: 'concrete', toraFt: 14511, ldaFt: 14511,
          ils: { freq: 111.70, ident: 'IJFQ', course: 120.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH54X' } },
        { ident: '31L', paired: '13R', hdgTrue: 300.9, hdgMag: 314.1, lengthFt: 14511, widthFt: 200, lat: 40.62790, lon: -73.77160, elevFt: 13, surface: 'concrete', toraFt: 14511, ldaFt: 14511,
          ils: { freq: 111.90, ident: 'IJFR', course: 300.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH56X' } }
      ]
    },
    {
      icao: 'KLAX', iata: 'LAX',
      name: 'Los Angeles International Airport', nameZh: '洛杉矶国际机场',
      city: 'Los Angeles', cityZh: '洛杉矶', country: 'United States', countryZh: '美国',
      region: 'north-america', lat: 33.94250, lon: -118.40800, elevFt: 125, magVar: 13.1, tz: -8,
      transitionAltFt: 18000, size: 'large',
      runways: [
        { ident: '06L', paired: '24R', hdgTrue: 73.1, hdgMag: 60.0, lengthFt: 8926, widthFt: 150, lat: 33.94706, lon: -118.43068, elevFt: 112, surface: 'concrete', toraFt: 8926, ldaFt: 8926,
          ils: { freq: 110.30, ident: 'ILAW', course: 73.1, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH40X' } },
        { ident: '24R', paired: '06L', hdgTrue: 253.1, hdgMag: 240.0, lengthFt: 8926, widthFt: 150, lat: 33.95417, lon: -118.40246, elevFt: 117, surface: 'concrete', toraFt: 8926, ldaFt: 8926,
          ils: { freq: 111.10, ident: 'ILAX', course: 253.1, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH48X' } },
        { ident: '06R', paired: '24L', hdgTrue: 73.1, hdgMag: 60.0, lengthFt: 10859, widthFt: 150, lat: 33.94432, lon: -118.43404, elevFt: 108, surface: 'concrete', toraFt: 10859, ldaFt: 10859,
          ils: { freq: 109.90, ident: 'ILAV', course: 73.1, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH36X' } },
        { ident: '24L', paired: '06R', hdgTrue: 253.1, hdgMag: 240.0, lengthFt: 10859, widthFt: 150, lat: 33.95297, lon: -118.39971, elevFt: 111, surface: 'concrete', toraFt: 10859, ldaFt: 10859,
          ils: { freq: 111.70, ident: 'ILAU', course: 253.1, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH54X' } },
        { ident: '07L', paired: '25R', hdgTrue: 83.0, hdgMag: 69.9, lengthFt: 12894, widthFt: 150, lat: 33.93556, lon: -118.42209, elevFt: 119, surface: 'concrete', toraFt: 12894, ldaFt: 12894,
          ils: { freq: 108.10, ident: 'ILAT', course: 83.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH18X' } },
        { ident: '25R', paired: '07L', hdgTrue: 263.0, hdgMag: 249.9, lengthFt: 12894, widthFt: 150, lat: 33.93988, lon: -118.37979, elevFt: 94, surface: 'concrete', toraFt: 12894, ldaFt: 12894,
          ils: { freq: 111.90, ident: 'ILAS', course: 263.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH56X' } },
        { ident: '07R', paired: '25L', hdgTrue: 83.0, hdgMag: 69.9, lengthFt: 11095, widthFt: 200, lat: 33.93366, lon: -118.41907, elevFt: 118, surface: 'concrete', toraFt: 11095, ldaFt: 11095,
          ils: { freq: 110.90, ident: 'ILAZ', course: 83.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH46X' } },
        { ident: '25L', paired: '07R', hdgTrue: 263.0, hdgMag: 249.9, lengthFt: 11095, widthFt: 200, lat: 33.93737, lon: -118.38270, elevFt: 95, surface: 'concrete', toraFt: 11095, ldaFt: 11095,
          ils: { freq: 108.90, ident: 'ILAY', course: 263.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH26X' } }
      ]
    },
    {
      icao: 'KORD', iata: 'ORD',
      name: 'Chicago O\'Hare International Airport', nameZh: '芝加哥奥黑尔国际机场',
      city: 'Chicago', cityZh: '芝加哥', country: 'United States', countryZh: '美国',
      region: 'north-america', lat: 41.97860, lon: -87.90480, elevFt: 680, magVar: -3.0, tz: -6,
      transitionAltFt: 18000, size: 'large',
      runways: [
        { ident: '04L', paired: '22R', hdgTrue: 39.5, hdgMag: 42.5, lengthFt: 7500, widthFt: 150, lat: 41.98170, lon: -87.91390, elevFt: 656, surface: 'asphalt', toraFt: 7500, ldaFt: 7500,
          ils: { freq: 110.50, ident: 'IORS', course: 39.5, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH42X' } },
        { ident: '22R', paired: '04L', hdgTrue: 219.5, hdgMag: 222.5, lengthFt: 7500, widthFt: 150, lat: 41.99750, lon: -87.89640, elevFt: 648, surface: 'asphalt', toraFt: 7500, ldaFt: 7500,
          ils: null },
        { ident: '04R', paired: '22L', hdgTrue: 41.3, hdgMag: 44.3, lengthFt: 8075, widthFt: 150, lat: 41.95330, lon: -87.89940, elevFt: 661, surface: 'asphalt', toraFt: 8075, ldaFt: 8075,
          ils: { freq: 108.10, ident: 'IORU', course: 41.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH18X' } },
        { ident: '22L', paired: '04R', hdgTrue: 221.3, hdgMag: 224.3, lengthFt: 8075, widthFt: 150, lat: 41.96990, lon: -87.87980, elevFt: 651, surface: 'asphalt', toraFt: 8075, ldaFt: 8075,
          ils: { freq: 108.30, ident: 'IORV', course: 221.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH20X' } },
        { ident: '09C', paired: '27C', hdgTrue: 90.0, hdgMag: 93.0, lengthFt: 11245, widthFt: 200, lat: 41.98831, lon: -87.93158, elevFt: 680, surface: 'concrete', toraFt: 11245, ldaFt: 11245,
          ils: { freq: 110.10, ident: 'IORQ', course: 90.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH38X' } },
        { ident: '27C', paired: '09C', hdgTrue: 270.0, hdgMag: 273.0, lengthFt: 11245, widthFt: 200, lat: 41.98833, lon: -87.89021, elevFt: 680, surface: 'concrete', toraFt: 11245, ldaFt: 11245,
          ils: { freq: 111.50, ident: 'IORP', course: 270.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH52X' } },
        { ident: '09L', paired: '27R', hdgTrue: 90.0, hdgMag: 93.0, lengthFt: 7500, widthFt: 150, lat: 42.00283, lon: -87.92667, elevFt: 668, surface: 'asphalt', toraFt: 7500, ldaFt: 7500,
          ils: { freq: 108.50, ident: 'IORM', course: 90.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH22X' } },
        { ident: '27R', paired: '09L', hdgTrue: 270.0, hdgMag: 273.0, lengthFt: 7500, widthFt: 150, lat: 42.00283, lon: -87.89909, elevFt: 664, surface: 'asphalt', toraFt: 7500, ldaFt: 7500,
          ils: { freq: 110.15, ident: 'IORN', course: 270.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH38Y' } },
        { ident: '09R', paired: '27L', hdgTrue: 90.0, hdgMag: 93.0, lengthFt: 11260, widthFt: 150, lat: 41.98389, lon: -87.92446, elevFt: 660, surface: 'asphalt', toraFt: 11260, ldaFt: 11260,
          ils: { freq: 111.10, ident: 'IORR', course: 90.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '27L', paired: '09R', hdgTrue: 270.0, hdgMag: 273.0, lengthFt: 11260, widthFt: 150, lat: 41.98390, lon: -87.88294, elevFt: 650, surface: 'asphalt', toraFt: 11260, ldaFt: 11260,
          ils: { freq: 110.70, ident: 'IORL', course: 270.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } },
        { ident: '10C', paired: '28C', hdgTrue: 97.0, hdgMag: 100.0, lengthFt: 10800, widthFt: 200, lat: 41.96750, lon: -87.93141, elevFt: 669, surface: 'concrete', toraFt: 10800, ldaFt: 10800,
          ils: { freq: 110.30, ident: 'IORD', course: 97.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '28C', paired: '10C', hdgTrue: 277.0, hdgMag: 280.0, lengthFt: 10800, widthFt: 200, lat: 41.96389, lon: -87.89189, elevFt: 650, surface: 'concrete', toraFt: 10800, ldaFt: 10800,
          ils: { freq: 109.30, ident: 'IORC', course: 277.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH30X' } },
        { ident: '10L', paired: '28R', hdgTrue: 97.0, hdgMag: 100.0, lengthFt: 13000, widthFt: 150, lat: 41.97122, lon: -87.93139, elevFt: 672, surface: 'concrete', toraFt: 13000, ldaFt: 13000,
          ils: { freq: 108.90, ident: 'IORX', course: 97.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '28R', paired: '10L', hdgTrue: 277.0, hdgMag: 280.0, lengthFt: 13000, widthFt: 150, lat: 41.96688, lon: -87.88382, elevFt: 651, surface: 'concrete', toraFt: 13000, ldaFt: 13000,
          ils: { freq: 109.90, ident: 'IORY', course: 277.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH36X' } },
        { ident: '10R', paired: '28L', hdgTrue: 97.0, hdgMag: 100.0, lengthFt: 7500, widthFt: 150, lat: 41.95847, lon: -87.92782, elevFt: 680, surface: 'concrete', toraFt: 7500, ldaFt: 7500,
          ils: { freq: 111.70, ident: 'IORZ', course: 97.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH54X' } },
        { ident: '28L', paired: '10R', hdgTrue: 277.0, hdgMag: 280.0, lengthFt: 7500, widthFt: 150, lat: 41.95597, lon: -87.90038, elevFt: 658, surface: 'concrete', toraFt: 7500, ldaFt: 7500,
          ils: { freq: 111.90, ident: 'IORW', course: 277.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH56X' } }
      ]
    },
    {
      icao: 'KATL', iata: 'ATL',
      name: 'Hartsfield-Jackson Atlanta International Airport', nameZh: '亚特兰大哈茨菲尔德-杰克逊国际机场',
      city: 'Atlanta', cityZh: '亚特兰大', country: 'United States', countryZh: '美国',
      region: 'north-america', lat: 33.63670, lon: -84.42810, elevFt: 1026, magVar: -4.0, tz: -5,
      transitionAltFt: 18000, size: 'large',
      runways: [
        { ident: '08L', paired: '26R', hdgTrue: 76.0, hdgMag: 80.0, lengthFt: 9000, widthFt: 150, lat: 33.64652, lon: -84.43863, elevFt: 1015, surface: 'concrete', toraFt: 9000, ldaFt: 9000,
          ils: { freq: 108.90, ident: 'IATU', course: 76.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '26R', paired: '08L', hdgTrue: 256.0, hdgMag: 260.0, lengthFt: 9000, widthFt: 150, lat: 33.65249, lon: -84.40987, elevFt: 990, surface: 'concrete', toraFt: 9000, ldaFt: 9000,
          ils: { freq: 109.90, ident: 'IATV', course: 256.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH36X' } },
        { ident: '08R', paired: '26L', hdgTrue: 76.0, hdgMag: 80.0, lengthFt: 9999, widthFt: 150, lat: 33.64348, lon: -84.43792, elevFt: 1024, surface: 'concrete', toraFt: 9999, ldaFt: 9999,
          ils: { freq: 110.30, ident: 'IATL', course: 76.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '26L', paired: '08R', hdgTrue: 256.0, hdgMag: 260.0, lengthFt: 9999, widthFt: 150, lat: 33.65012, lon: -84.40598, elevFt: 995, surface: 'concrete', toraFt: 9999, ldaFt: 9999,
          ils: { freq: 109.30, ident: 'IATR', course: 256.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH30X' } },
        { ident: '09L', paired: '27R', hdgTrue: 90.0, hdgMag: 94.0, lengthFt: 12390, widthFt: 150, lat: 33.63470, lon: -84.44800, elevFt: 1019, surface: 'concrete', toraFt: 12390, ldaFt: 12390,
          ils: { freq: 111.10, ident: 'IATS', course: 90.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '27R', paired: '09L', hdgTrue: 270.0, hdgMag: 274.0, lengthFt: 12390, widthFt: 150, lat: 33.63470, lon: -84.40890, elevFt: 978, surface: 'concrete', toraFt: 12390, ldaFt: 12390,
          ils: { freq: 110.70, ident: 'IATT', course: 270.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } },
        { ident: '09R', paired: '27L', hdgTrue: 90.0, hdgMag: 94.0, lengthFt: 9000, widthFt: 150, lat: 33.63180, lon: -84.44800, elevFt: 1026, surface: 'concrete', toraFt: 9000, ldaFt: 9000,
          ils: { freq: 111.70, ident: 'IATW', course: 90.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH54X' } },
        { ident: '27L', paired: '09R', hdgTrue: 270.0, hdgMag: 274.0, lengthFt: 9000, widthFt: 150, lat: 33.63180, lon: -84.41840, elevFt: 985, surface: 'concrete', toraFt: 9000, ldaFt: 9000,
          ils: { freq: 111.90, ident: 'IATX', course: 270.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH56X' } },
        { ident: '10', paired: '28', hdgTrue: 96.0, hdgMag: 100.0, lengthFt: 9000, widthFt: 150, lat: 33.62159, lon: -84.44783, elevFt: 1000, surface: 'concrete', toraFt: 9000, ldaFt: 9000,
          ils: { freq: 110.10, ident: 'IATY', course: 96.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH38X' } },
        { ident: '28', paired: '10', hdgTrue: 276.0, hdgMag: 280.0, lengthFt: 9000, widthFt: 150, lat: 33.61901, lon: -84.41837, elevFt: 998, surface: 'concrete', toraFt: 9000, ldaFt: 9000,
          ils: { freq: 110.50, ident: 'IATZ', course: 276.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH42X' } }
      ]
    },
    {
      icao: 'KSFO', iata: 'SFO',
      name: 'San Francisco International Airport', nameZh: '旧金山国际机场',
      city: 'San Francisco', cityZh: '旧金山', country: 'United States', countryZh: '美国',
      region: 'north-america', lat: 37.61981, lon: -122.37482, elevFt: 13, magVar: 14.4, tz: -8,
      transitionAltFt: 18000, size: 'large',
      runways: [
        { ident: '10L', paired: '28R', hdgTrue: 117.9, hdgMag: 103.5, lengthFt: 11870, widthFt: 200, lat: 37.62874, lon: -122.39341, elevFt: 5, surface: 'asphalt', toraFt: 11870, ldaFt: 11870,
          ils: { freq: 109.30, ident: 'ISFL', course: 117.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH30X' } },
        { ident: '28R', paired: '10L', hdgTrue: 297.9, hdgMag: 283.5, lengthFt: 11870, widthFt: 200, lat: 37.61354, lon: -122.35716, elevFt: 13, surface: 'asphalt', toraFt: 11870, ldaFt: 11870,
          ils: { freq: 110.30, ident: 'ISFO', course: 297.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '10R', paired: '28L', hdgTrue: 117.9, hdgMag: 103.5, lengthFt: 11381, widthFt: 200, lat: 37.62630, lon: -122.39312, elevFt: 6, surface: 'asphalt', toraFt: 11381, ldaFt: 11381,
          ils: { freq: 110.70, ident: 'ISFN', course: 117.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } },
        { ident: '28L', paired: '10R', hdgTrue: 297.9, hdgMag: 283.5, lengthFt: 11381, widthFt: 200, lat: 37.61172, lon: -122.35837, elevFt: 13, surface: 'asphalt', toraFt: 11381, ldaFt: 11381,
          ils: { freq: 111.10, ident: 'ISFM', course: 297.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH48X' } },
        { ident: '01L', paired: '19R', hdgTrue: 27.7, hdgMag: 13.3, lengthFt: 7650, widthFt: 200, lat: 37.60790, lon: -122.38295, elevFt: 10, surface: 'asphalt', toraFt: 7650, ldaFt: 7650,
          ils: { freq: 108.10, ident: 'ISFS', course: 27.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH18X' } },
        { ident: '19R', paired: '01L', hdgTrue: 207.7, hdgMag: 193.3, lengthFt: 7650, widthFt: 200, lat: 37.62648, lon: -122.37063, elevFt: 9, surface: 'asphalt', toraFt: 7650, ldaFt: 7650,
          ils: { freq: 111.90, ident: 'ISFR', course: 207.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH56X' } },
        { ident: '01R', paired: '19L', hdgTrue: 27.7, hdgMag: 13.3, lengthFt: 8660, widthFt: 200, lat: 37.60633, lon: -122.38106, elevFt: 12, surface: 'asphalt', toraFt: 8660, ldaFt: 8660,
          ils: { freq: 111.70, ident: 'ISFQ', course: 27.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH54X' } },
        { ident: '19L', paired: '01R', hdgTrue: 207.7, hdgMag: 193.3, lengthFt: 8660, widthFt: 200, lat: 37.62735, lon: -122.36712, elevFt: 10, surface: 'asphalt', toraFt: 8660, ldaFt: 8660,
          ils: { freq: 108.90, ident: 'ISFP', course: 207.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } }
      ]
    },
    {
      icao: 'KSEA', iata: 'SEA',
      name: 'Seattle-Tacoma International Airport', nameZh: '西雅图-塔科马国际机场',
      city: 'Seattle', cityZh: '西雅图', country: 'United States', countryZh: '美国',
      region: 'north-america', lat: 47.44794, lon: -122.31028, elevFt: 433, magVar: 17.4, tz: -8,
      transitionAltFt: 18000, size: 'large',
      runways: [
        { ident: '16C', paired: '34C', hdgTrue: 180.0, hdgMag: 162.6, lengthFt: 9426, widthFt: 150, lat: 47.46380, lon: -122.31100, elevFt: 430, surface: 'concrete', toraFt: 9426, ldaFt: 9426,
          ils: { freq: 111.10, ident: 'ISEC', course: 180.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '34C', paired: '16C', hdgTrue: 0.0, hdgMag: 342.6, lengthFt: 9426, widthFt: 150, lat: 47.43800, lon: -122.31100, elevFt: 363, surface: 'concrete', toraFt: 9426, ldaFt: 9426,
          ils: { freq: 110.70, ident: 'ISED', course: 0.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } },
        { ident: '16L', paired: '34R', hdgTrue: 180.0, hdgMag: 162.6, lengthFt: 11901, widthFt: 150, lat: 47.46380, lon: -122.30800, elevFt: 432, surface: 'concrete', toraFt: 11901, ldaFt: 11901,
          ils: { freq: 110.30, ident: 'ISEA', course: 180.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '34R', paired: '16L', hdgTrue: 0.0, hdgMag: 342.6, lengthFt: 11901, widthFt: 150, lat: 47.43120, lon: -122.30800, elevFt: 347, surface: 'concrete', toraFt: 11901, ldaFt: 11901,
          ils: { freq: 109.30, ident: 'ISEB', course: 0.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } },
        { ident: '16R', paired: '34L', hdgTrue: 180.0, hdgMag: 162.6, lengthFt: 8500, widthFt: 150, lat: 47.46380, lon: -122.31800, elevFt: 430, surface: 'concrete', toraFt: 8500, ldaFt: 8500,
          ils: { freq: 108.90, ident: 'ISEE', course: 180.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '34L', paired: '16R', hdgTrue: 0.0, hdgMag: 342.6, lengthFt: 8500, widthFt: 150, lat: 47.44050, lon: -122.31800, elevFt: 363, surface: 'concrete', toraFt: 8500, ldaFt: 8500,
          ils: { freq: 111.70, ident: 'ISEF', course: 0.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH54X' } }
      ]
    },
    {
      icao: 'KDEN', iata: 'DEN',
      name: 'Denver International Airport', nameZh: '丹佛国际机场',
      city: 'Denver', cityZh: '丹佛', country: 'United States', countryZh: '美国',
      region: 'north-america', lat: 39.86003, lon: -104.67379, elevFt: 5434, magVar: 9.3, tz: -7,
      transitionAltFt: 18000, size: 'large',
      runways: [
        { ident: '07', paired: '25', hdgTrue: 79.3, hdgMag: 70.0, lengthFt: 12000, widthFt: 150, lat: 39.83774, lon: -104.72654, elevFt: 5347, surface: 'concrete', toraFt: 12000, ldaFt: 12000,
          ils: { freq: 111.90, ident: 'IDET', course: 79.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH56X' } },
        { ident: '25', paired: '07', hdgTrue: 259.3, hdgMag: 250.0, lengthFt: 12000, widthFt: 150, lat: 39.84385, lon: -104.68445, elevFt: 5352, surface: 'concrete', toraFt: 12000, ldaFt: 12000,
          ils: null },
        { ident: '08', paired: '26', hdgTrue: 90.7, hdgMag: 81.4, lengthFt: 12000, widthFt: 150, lat: 39.87760, lon: -104.66200, elevFt: 5351, surface: 'concrete', toraFt: 12000, ldaFt: 12000,
          ils: { freq: 108.10, ident: 'IDEU', course: 90.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH18X' } },
        { ident: '26', paired: '08', hdgTrue: 270.7, hdgMag: 261.4, lengthFt: 12000, widthFt: 150, lat: 39.87720, lon: -104.61900, elevFt: 5291, surface: 'concrete', toraFt: 12000, ldaFt: 12000,
          ils: null },
        { ident: '16L', paired: '34R', hdgTrue: 169.3, hdgMag: 160.0, lengthFt: 12000, widthFt: 150, lat: 39.89671, lon: -104.69098, elevFt: 5347, surface: 'concrete', toraFt: 12000, ldaFt: 12000,
          ils: { freq: 111.10, ident: 'IDEP', course: 169.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '34R', paired: '16L', hdgTrue: 349.3, hdgMag: 340.0, lengthFt: 12000, widthFt: 150, lat: 39.86439, lon: -104.68302, elevFt: 5351, surface: 'concrete', toraFt: 12000, ldaFt: 12000,
          ils: { freq: 110.70, ident: 'IDEQ', course: 349.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } },
        { ident: '16R', paired: '34L', hdgTrue: 169.3, hdgMag: 160.0, lengthFt: 16000, widthFt: 200, lat: 39.89540, lon: -104.70181, elevFt: 5319, surface: 'concrete', toraFt: 16000, ldaFt: 16000,
          ils: { freq: 110.30, ident: 'IDEN', course: 169.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '34L', paired: '16R', hdgTrue: 349.3, hdgMag: 340.0, lengthFt: 16000, widthFt: 200, lat: 39.85230, lon: -104.69120, elevFt: 5324, surface: 'concrete', toraFt: 16000, ldaFt: 16000,
          ils: { freq: 109.30, ident: 'IDEO', course: 349.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } },
        { ident: '17L', paired: '35R', hdgTrue: 181.3, hdgMag: 172.0, lengthFt: 12000, widthFt: 150, lat: 39.86500, lon: -104.64100, elevFt: 5325, surface: 'concrete', toraFt: 12000, ldaFt: 12000,
          ils: { freq: 110.10, ident: 'IDEV', course: 181.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH38X' } },
        { ident: '35R', paired: '17L', hdgTrue: 1.3, hdgMag: 352.0, lengthFt: 12000, widthFt: 150, lat: 39.83200, lon: -104.64200, elevFt: 5367, surface: 'concrete', toraFt: 12000, ldaFt: 12000,
          ils: { freq: 110.50, ident: 'IDEW', course: 1.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH42X' } },
        { ident: '17R', paired: '35L', hdgTrue: 181.3, hdgMag: 172.0, lengthFt: 12000, widthFt: 150, lat: 39.86120, lon: -104.66000, elevFt: 5374, surface: 'concrete', toraFt: 12000, ldaFt: 12000,
          ils: { freq: 108.90, ident: 'IDER', course: 181.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '35L', paired: '17R', hdgTrue: 1.3, hdgMag: 352.0, lengthFt: 12000, widthFt: 150, lat: 39.82830, lon: -104.66100, elevFt: 5431, surface: 'concrete', toraFt: 12000, ldaFt: 12000,
          ils: { freq: 111.70, ident: 'IDES', course: 1.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH54X' } }
      ]
    },
    {
      icao: 'KDFW', iata: 'DFW',
      name: 'Dallas/Fort Worth International Airport', nameZh: '达拉斯-沃思堡国际机场',
      city: 'Dallas', cityZh: '达拉斯', country: 'United States', countryZh: '美国',
      region: 'north-america', lat: 32.89680, lon: -97.03800, elevFt: 607, magVar: 4.5, tz: -6,
      transitionAltFt: 18000, size: 'large',
      runways: [
        { ident: '13L', paired: '31R', hdgTrue: 135.4, hdgMag: 130.9, lengthFt: 9000, widthFt: 200, lat: 32.91260, lon: -97.02150, elevFt: 550, surface: 'concrete', toraFt: 9000, ldaFt: 9000,
          ils: { freq: 108.10, ident: 'IDFF', course: 135.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH18X' } },
        { ident: '31R', paired: '13L', hdgTrue: 315.4, hdgMag: 310.9, lengthFt: 9000, widthFt: 200, lat: 32.89500, lon: -97.00080, elevFt: 508, surface: 'concrete', toraFt: 9000, ldaFt: 9000,
          ils: null },
        { ident: '13R', paired: '31L', hdgTrue: 139.3, hdgMag: 134.8, lengthFt: 9300, widthFt: 150, lat: 32.90960, lon: -97.08310, elevFt: 591, surface: 'concrete', toraFt: 9300, ldaFt: 9300,
          ils: { freq: 111.90, ident: 'IDFC', course: 139.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH56X' } },
        { ident: '31L', paired: '13R', hdgTrue: 319.3, hdgMag: 314.8, lengthFt: 9300, widthFt: 150, lat: 32.89030, lon: -97.06330, elevFt: 577, surface: 'concrete', toraFt: 9300, ldaFt: 9300,
          ils: null },
        { ident: '17C', paired: '35C', hdgTrue: 174.5, hdgMag: 170.0, lengthFt: 13400, widthFt: 150, lat: 32.91558, lon: -97.02820, elevFt: 562, surface: 'concrete', toraFt: 13400, ldaFt: 13400,
          ils: { freq: 111.10, ident: 'IDFY', course: 174.5, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '35C', paired: '17C', hdgTrue: 354.5, hdgMag: 350.0, lengthFt: 13400, widthFt: 150, lat: 32.87902, lon: -97.02400, elevFt: 562, surface: 'concrete', toraFt: 13400, ldaFt: 13400,
          ils: { freq: 110.70, ident: 'IDFZ', course: 354.5, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } },
        { ident: '17L', paired: '35R', hdgTrue: 174.5, hdgMag: 170.0, lengthFt: 8500, widthFt: 150, lat: 32.89825, lon: -97.01118, elevFt: 524, surface: 'concrete', toraFt: 8500, ldaFt: 8500,
          ils: { freq: 110.10, ident: 'IDFD', course: 174.5, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH38X' } },
        { ident: '35R', paired: '17L', hdgTrue: 354.5, hdgMag: 350.0, lengthFt: 8500, widthFt: 150, lat: 32.87505, lon: -97.00852, elevFt: 575, surface: 'concrete', toraFt: 8500, ldaFt: 8500,
          ils: { freq: 110.50, ident: 'IDFE', course: 354.5, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH42X' } },
        { ident: '17R', paired: '35L', hdgTrue: 174.5, hdgMag: 170.0, lengthFt: 13400, widthFt: 200, lat: 32.91558, lon: -97.03210, elevFt: 567, surface: 'concrete', toraFt: 13400, ldaFt: 13400,
          ils: { freq: 110.30, ident: 'IDFW', course: 174.5, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '35L', paired: '17R', hdgTrue: 354.5, hdgMag: 350.0, lengthFt: 13400, widthFt: 200, lat: 32.87902, lon: -97.02790, elevFt: 563, surface: 'concrete', toraFt: 13400, ldaFt: 13400,
          ils: { freq: 109.30, ident: 'IDFX', course: 354.5, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH30X' } },
        { ident: '18L', paired: '36R', hdgTrue: 180.3, hdgMag: 175.8, lengthFt: 13401, widthFt: 200, lat: 32.91580, lon: -97.05070, elevFt: 602, surface: 'concrete', toraFt: 13401, ldaFt: 13401,
          ils: { freq: 108.30, ident: 'IDFG', course: 180.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH20X' } },
        { ident: '36R', paired: '18L', hdgTrue: 0.3, hdgMag: 355.8, lengthFt: 13401, widthFt: 200, lat: 32.87900, lon: -97.05090, elevFt: 575, surface: 'concrete', toraFt: 13401, ldaFt: 13401,
          ils: null },
        { ident: '18R', paired: '36L', hdgTrue: 180.3, hdgMag: 175.8, lengthFt: 13400, widthFt: 150, lat: 32.91580, lon: -97.05460, elevFt: 607, surface: 'concrete', toraFt: 13400, ldaFt: 13400,
          ils: { freq: 108.90, ident: 'IDFA', course: 180.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH26X' } },
        { ident: '36L', paired: '18R', hdgTrue: 0.3, hdgMag: 355.8, lengthFt: 13400, widthFt: 150, lat: 32.87900, lon: -97.05480, elevFt: 582, surface: 'concrete', toraFt: 13400, ldaFt: 13400,
          ils: { freq: 111.70, ident: 'IDFB', course: 0.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH54X' } }
      ]
    },
    {
      icao: 'KMIA', iata: 'MIA',
      name: 'Miami International Airport', nameZh: '迈阿密国际机场',
      city: 'Miami', cityZh: '迈阿密', country: 'United States', countryZh: '美国',
      region: 'north-america', lat: 25.79601, lon: -80.28975, elevFt: 8, magVar: -5.3, tz: -5,
      transitionAltFt: 18000, size: 'large',
      runways: [
        { ident: '08L', paired: '26R', hdgTrue: 74.7, hdgMag: 80.0, lengthFt: 8600, widthFt: 150, lat: 25.80034, lon: -80.30108, elevFt: 8, surface: 'asphalt', toraFt: 8600, ldaFt: 8600,
          ils: { freq: 111.90, ident: 'IMII', course: 74.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH56X' } },
        { ident: '26R', paired: '08L', hdgTrue: 254.7, hdgMag: 260.0, lengthFt: 8600, widthFt: 150, lat: 25.80656, lon: -80.27582, elevFt: 8, surface: 'asphalt', toraFt: 8600, ldaFt: 8600,
          ils: { freq: 108.10, ident: 'IMIL', course: 254.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH18X' } },
        { ident: '08R', paired: '26L', hdgTrue: 74.7, hdgMag: 80.0, lengthFt: 10506, widthFt: 200, lat: 25.79755, lon: -80.30088, elevFt: 8, surface: 'asphalt', toraFt: 10506, ldaFt: 10506,
          ils: { freq: 111.10, ident: 'IMIC', course: 74.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH48X' } },
        { ident: '26L', paired: '08R', hdgTrue: 254.7, hdgMag: 260.0, lengthFt: 10506, widthFt: 200, lat: 25.80515, lon: -80.27002, elevFt: 8, surface: 'asphalt', toraFt: 10506, ldaFt: 10506,
          ils: { freq: 110.70, ident: 'IMID', course: 254.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH44X' } },
        { ident: '09', paired: '27', hdgTrue: 87.4, hdgMag: 92.7, lengthFt: 13016, widthFt: 150, lat: 25.78610, lon: -80.31480, elevFt: 7, surface: 'asphalt', toraFt: 13016, ldaFt: 13016,
          ils: { freq: 110.30, ident: 'IMIA', course: 87.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '27', paired: '09', hdgTrue: 267.4, hdgMag: 272.7, lengthFt: 13016, widthFt: 150, lat: 25.78770, lon: -80.27540, elevFt: 8, surface: 'asphalt', toraFt: 13016, ldaFt: 13016,
          ils: { freq: 109.30, ident: 'IMIB', course: 267.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH30X' } },
        { ident: '12', paired: '30', hdgTrue: 119.6, hdgMag: 124.9, lengthFt: 9360, widthFt: 150, lat: 25.79930, lon: -80.30230, elevFt: 8, surface: 'asphalt', toraFt: 9360, ldaFt: 9360,
          ils: { freq: 108.90, ident: 'IMIG', course: 119.6, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '30', paired: '12', hdgTrue: 299.6, hdgMag: 304.9, lengthFt: 9360, widthFt: 150, lat: 25.78660, lon: -80.27750, elevFt: 8, surface: 'asphalt', toraFt: 9360, ldaFt: 9360,
          ils: { freq: 111.70, ident: 'IMIF', course: 299.6, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH54X' } }
      ]
    },
    {
      icao: 'KBOS', iata: 'BOS',
      name: 'Boston Logan International Airport', nameZh: '波士顿洛根国际机场',
      city: 'Boston', cityZh: '波士顿', country: 'United States', countryZh: '美国',
      region: 'north-america', lat: 42.36197, lon: -71.00790, elevFt: 20, magVar: -15.2, tz: -5,
      transitionAltFt: 18000, size: 'large',
      runways: [
        { ident: '04L', paired: '22R', hdgTrue: 19.7, hdgMag: 34.9, lengthFt: 7864, widthFt: 150, lat: 42.35800, lon: -71.01434, elevFt: 14, surface: 'asphalt', toraFt: 7864, ldaFt: 7864,
          ils: { freq: 108.90, ident: 'IBOW', course: 19.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '22R', paired: '04L', hdgTrue: 199.7, hdgMag: 214.9, lengthFt: 7864, widthFt: 150, lat: 42.37832, lon: -71.00451, elevFt: 15, surface: 'asphalt', toraFt: 7864, ldaFt: 7864,
          ils: { freq: 111.70, ident: 'IBOX', course: 199.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH54X' } },
        { ident: '04R', paired: '22L', hdgTrue: 19.7, hdgMag: 34.9, lengthFt: 10006, widthFt: 150, lat: 42.35106, lon: -71.01180, elevFt: 18, surface: 'asphalt', toraFt: 10006, ldaFt: 10006,
          ils: { freq: 110.30, ident: 'IBOS', course: 19.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '22L', paired: '04R', hdgTrue: 199.7, hdgMag: 214.9, lengthFt: 10006, widthFt: 150, lat: 42.37692, lon: -70.99929, elevFt: 16, surface: 'asphalt', toraFt: 10006, ldaFt: 10006,
          ils: { freq: 109.30, ident: 'IBOT', course: 199.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } },
        { ident: '09', paired: '27', hdgTrue: 76.7, hdgMag: 91.9, lengthFt: 7001, widthFt: 150, lat: 42.35580, lon: -71.01290, elevFt: 17, surface: 'asphalt', toraFt: 7001, ldaFt: 7001,
          ils: { freq: 111.90, ident: 'IBOY', course: 76.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH56X' } },
        { ident: '27', paired: '09', hdgTrue: 256.7, hdgMag: 271.9, lengthFt: 7001, widthFt: 150, lat: 42.36020, lon: -70.98770, elevFt: 15, surface: 'asphalt', toraFt: 7001, ldaFt: 7001,
          ils: { freq: 108.10, ident: 'IBOZ', course: 256.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH18X' } },
        { ident: '14', paired: '32', hdgTrue: 125.6, hdgMag: 140.8, lengthFt: 5000, widthFt: 100, lat: 42.35660, lon: -71.02330, elevFt: 17, surface: 'asphalt', toraFt: 5000, ldaFt: 5000,
          ils: null },
        { ident: '32', paired: '14', hdgTrue: 305.6, hdgMag: 320.8, lengthFt: 5000, widthFt: 100, lat: 42.34860, lon: -71.00820, elevFt: 20, surface: 'asphalt', toraFt: 5000, ldaFt: 5000,
          ils: null },
        { ident: '15L', paired: '33R', hdgTrue: 135.7, hdgMag: 150.9, lengthFt: 2557, widthFt: 100, lat: 42.37360, lon: -71.00910, elevFt: 15, surface: 'asphalt', toraFt: 2557, ldaFt: 2557,
          ils: null },
        { ident: '33R', paired: '15L', hdgTrue: 315.7, hdgMag: 330.9, lengthFt: 2557, widthFt: 100, lat: 42.36860, lon: -71.00250, elevFt: 14, surface: 'asphalt', toraFt: 2557, ldaFt: 2557,
          ils: null },
        { ident: '15R', paired: '33L', hdgTrue: 135.4, hdgMag: 150.6, lengthFt: 10083, widthFt: 150, lat: 42.37430, lon: -71.01790, elevFt: 17, surface: 'asphalt', toraFt: 10083, ldaFt: 10083,
          ils: { freq: 111.10, ident: 'IBOU', course: 135.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '33L', paired: '15R', hdgTrue: 315.4, hdgMag: 330.6, lengthFt: 10083, widthFt: 150, lat: 42.35460, lon: -70.99160, elevFt: 15, surface: 'asphalt', toraFt: 10083, ldaFt: 10083,
          ils: { freq: 110.70, ident: 'IBOV', course: 315.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } }
      ]
    },
    {
      icao: 'KLAS', iata: 'LAS',
      name: 'Harry Reid International Airport', nameZh: '拉斯维加斯哈里·里德国际机场',
      city: 'Las Vegas', cityZh: '拉斯维加斯', country: 'United States', countryZh: '美国',
      region: 'north-america', lat: 36.08336, lon: -115.15182, elevFt: 2181, magVar: 12.5, tz: -8,
      transitionAltFt: 18000, size: 'large',
      runways: [
        { ident: '01L', paired: '19R', hdgTrue: 23.4, hdgMag: 10.9, lengthFt: 9770, widthFt: 150, lat: 36.07421, lon: -115.17058, elevFt: 2176, surface: 'concrete', toraFt: 9770, ldaFt: 9770,
          ils: { freq: 111.70, ident: 'ILAY', course: 23.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH54X' } },
        { ident: '19R', paired: '01L', hdgTrue: 203.4, hdgMag: 190.9, lengthFt: 9770, widthFt: 150, lat: 36.09879, lon: -115.15741, elevFt: 2083, surface: 'concrete', toraFt: 9770, ldaFt: 9770,
          ils: { freq: 108.90, ident: 'ILAW', course: 203.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '01R', paired: '19L', hdgTrue: 24.9, hdgMag: 12.4, lengthFt: 9769, widthFt: 150, lat: 36.07417, lon: -115.16750, elevFt: 2170, surface: 'asphalt', toraFt: 9769, ldaFt: 9769,
          ils: null },
        { ident: '19L', paired: '01R', hdgTrue: 204.9, hdgMag: 192.4, lengthFt: 9769, widthFt: 150, lat: 36.09850, lon: -115.15350, elevFt: 2080, surface: 'asphalt', toraFt: 9769, ldaFt: 9769,
          ils: { freq: 111.90, ident: 'ILAZ', course: 204.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH56X' } },
        { ident: '08L', paired: '26R', hdgTrue: 90.0, hdgMag: 77.5, lengthFt: 14835, widthFt: 150, lat: 36.07633, lon: -115.17133, elevFt: 2155, surface: 'asphalt', toraFt: 14835, ldaFt: 14835,
          ils: { freq: 110.70, ident: 'ILAV', course: 90.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } },
        { ident: '26R', paired: '08L', hdgTrue: 270.0, hdgMag: 257.5, lengthFt: 14835, widthFt: 150, lat: 36.07633, lon: -115.12100, elevFt: 2044, surface: 'asphalt', toraFt: 14835, ldaFt: 14835,
          ils: { freq: 111.10, ident: 'ILAU', course: 270.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '08R', paired: '26L', hdgTrue: 89.8, hdgMag: 77.3, lengthFt: 10526, widthFt: 150, lat: 36.07360, lon: -115.16100, elevFt: 2157, surface: 'asphalt', toraFt: 10526, ldaFt: 10526,
          ils: { freq: 109.30, ident: 'ILAT', course: 89.8, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } },
        { ident: '26L', paired: '08R', hdgTrue: 269.8, hdgMag: 257.3, lengthFt: 10526, widthFt: 150, lat: 36.07370, lon: -115.12600, elevFt: 2048, surface: 'asphalt', toraFt: 10526, ldaFt: 10526,
          ils: { freq: 110.30, ident: 'ILAS', course: 269.8, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } }
      ]
    },
    {
      icao: 'KPHX', iata: 'PHX',
      name: 'Phoenix Sky Harbor International Airport', nameZh: '凤凰城天港国际机场',
      city: 'Phoenix', cityZh: '凤凰城', country: 'United States', countryZh: '美国',
      region: 'north-america', lat: 33.43530, lon: -112.00590, elevFt: 1135, magVar: 11.3, tz: -7,
      transitionAltFt: 18000, size: 'large',
      runways: [
        { ident: '07L', paired: '25R', hdgTrue: 81.3, hdgMag: 70.0, lengthFt: 10300, widthFt: 150, lat: 33.42891, lon: -112.02672, elevFt: 1110, surface: 'asphalt', toraFt: 10300, ldaFt: 10300,
          ils: { freq: 110.70, ident: 'IPHA', course: 81.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } },
        { ident: '25R', paired: '07L', hdgTrue: 261.3, hdgMag: 250.0, lengthFt: 10300, widthFt: 150, lat: 33.43318, lon: -111.99328, elevFt: 1134, surface: 'asphalt', toraFt: 10300, ldaFt: 10300,
          ils: { freq: 111.10, ident: 'IPHZ', course: 261.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '07R', paired: '25L', hdgTrue: 81.3, hdgMag: 70.0, lengthFt: 7800, widthFt: 150, lat: 33.42723, lon: -112.02716, elevFt: 1111, surface: 'concrete', toraFt: 7800, ldaFt: 7800,
          ils: { freq: 111.70, ident: 'IPHC', course: 81.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH54X' } },
        { ident: '25L', paired: '07R', hdgTrue: 261.3, hdgMag: 250.0, lengthFt: 7800, widthFt: 150, lat: 33.43047, lon: -112.00184, elevFt: 1126, surface: 'concrete', toraFt: 7800, ldaFt: 7800,
          ils: { freq: 108.90, ident: 'IPHB', course: 261.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '08', paired: '26', hdgTrue: 90.2, hdgMag: 78.9, lengthFt: 11489, widthFt: 150, lat: 33.44090, lon: -112.03000, elevFt: 1113, surface: 'concrete', toraFt: 11489, ldaFt: 11489,
          ils: { freq: 109.30, ident: 'IPHY', course: 90.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } },
        { ident: '26', paired: '08', hdgTrue: 270.2, hdgMag: 258.9, lengthFt: 11489, widthFt: 150, lat: 33.44080, lon: -111.99200, elevFt: 1135, surface: 'concrete', toraFt: 11489, ldaFt: 11489,
          ils: { freq: 110.30, ident: 'IPHX', course: 270.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } }
      ]
    },
    {
      icao: 'CYYZ', iata: 'YYZ',
      name: 'Toronto Pearson International Airport', nameZh: '多伦多皮尔逊国际机场',
      city: 'Toronto', cityZh: '多伦多', country: 'Canada', countryZh: '加拿大',
      region: 'north-america', lat: 43.67594, lon: -79.62942, elevFt: 569, magVar: -10.2, tz: -5,
      transitionAltFt: 18000, size: 'large',
      runways: [
        { ident: '05', paired: '23', hdgTrue: 39.8, hdgMag: 50.0, lengthFt: 11120, widthFt: 200, lat: 43.67259, lon: -79.66209, elevFt: 564, surface: 'asphalt', toraFt: 11120, ldaFt: 11120,
          ils: { freq: 111.10, ident: 'ITQ', course: 39.8, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '23', paired: '05', hdgTrue: 219.8, hdgMag: 230.0, lengthFt: 11120, widthFt: 200, lat: 43.69601, lon: -79.63511, elevFt: 560, surface: 'asphalt', toraFt: 11120, ldaFt: 11120,
          ils: { freq: 110.70, ident: 'ITR', course: 219.8, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } },
        { ident: '06L', paired: '24R', hdgTrue: 46.4, hdgMag: 56.6, lengthFt: 9697, widthFt: 200, lat: 43.66105, lon: -79.62343, elevFt: 529, surface: 'asphalt', toraFt: 9697, ldaFt: 9697,
          ils: { freq: 110.30, ident: 'ITO', course: 46.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '24R', paired: '06L', hdgTrue: 226.4, hdgMag: 236.6, lengthFt: 9697, widthFt: 200, lat: 43.67898, lon: -79.59737, elevFt: 546, surface: 'asphalt', toraFt: 9697, ldaFt: 9697,
          ils: { freq: 109.30, ident: 'ITP', course: 226.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH30X' } },
        { ident: '06R', paired: '24L', hdgTrue: 46.4, hdgMag: 56.6, lengthFt: 9000, widthFt: 200, lat: 43.65830, lon: -79.62193, elevFt: 525, surface: 'asphalt', toraFt: 9000, ldaFt: 9000,
          ils: { freq: 111.90, ident: 'ITV', course: 46.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH56X' } },
        { ident: '24L', paired: '06R', hdgTrue: 226.4, hdgMag: 236.6, lengthFt: 9000, widthFt: 200, lat: 43.67529, lon: -79.59724, elevFt: 547, surface: 'asphalt', toraFt: 9000, ldaFt: 9000,
          ils: { freq: 108.10, ident: 'ITW', course: 226.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH18X' } },
        { ident: '15L', paired: '33R', hdgTrue: 136.9, hdgMag: 147.1, lengthFt: 11050, widthFt: 200, lat: 43.69190, lon: -79.64220, elevFt: 557, surface: 'asphalt', toraFt: 11050, ldaFt: 11050,
          ils: { freq: 108.90, ident: 'ITT', course: 136.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '33R', paired: '15L', hdgTrue: 316.9, hdgMag: 327.1, lengthFt: 11050, widthFt: 200, lat: 43.67000, lon: -79.61390, elevFt: 544, surface: 'asphalt', toraFt: 11050, ldaFt: 11050,
          ils: { freq: 111.70, ident: 'ITU', course: 316.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH54X' } },
        { ident: '15R', paired: '33L', hdgTrue: 137.2, hdgMag: 147.4, lengthFt: 9088, widthFt: 200, lat: 43.68580, lon: -79.65170, elevFt: 551, surface: 'asphalt', toraFt: 9088, ldaFt: 9088,
          ils: null },
        { ident: '33L', paired: '15R', hdgTrue: 317.2, hdgMag: 327.4, lengthFt: 9088, widthFt: 200, lat: 43.66750, lon: -79.62830, elevFt: 544, surface: 'asphalt', toraFt: 9088, ldaFt: 9088,
          ils: null }
      ]
    },
    {
      icao: 'CYVR', iata: 'YVR',
      name: 'Vancouver International Airport', nameZh: '温哥华国际机场',
      city: 'Vancouver', cityZh: '温哥华', country: 'Canada', countryZh: '加拿大',
      region: 'north-america', lat: 49.19390, lon: -123.18400, elevFt: 14, magVar: 18.2, tz: -8,
      transitionAltFt: 18000, size: 'large',
      runways: [
        { ident: '08L', paired: '26R', hdgTrue: 99.3, hdgMag: 81.1, lengthFt: 9940, widthFt: 200, lat: 49.20500, lon: -123.20100, elevFt: 13, surface: 'concrete', toraFt: 9940, ldaFt: 9940,
          ils: { freq: 111.10, ident: 'IVT', course: 99.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '26R', paired: '08L', hdgTrue: 279.3, hdgMag: 261.1, lengthFt: 9940, widthFt: 200, lat: 49.20060, lon: -123.16000, elevFt: 9, surface: 'concrete', toraFt: 9940, ldaFt: 9940,
          ils: { freq: 110.70, ident: 'IVU', course: 279.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } },
        { ident: '08R', paired: '26L', hdgTrue: 100.5, hdgMag: 82.3, lengthFt: 11500, widthFt: 200, lat: 49.19010, lon: -123.20800, elevFt: 9, surface: 'asphalt', toraFt: 11500, ldaFt: 11500,
          ils: { freq: 110.30, ident: 'IVR', course: 100.5, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '26L', paired: '08R', hdgTrue: 280.5, hdgMag: 262.3, lengthFt: 11500, widthFt: 200, lat: 49.18440, lon: -123.16100, elevFt: 6, surface: 'asphalt', toraFt: 11500, ldaFt: 11500,
          ils: { freq: 109.30, ident: 'IVS', course: 280.5, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } },
        { ident: '13', paired: '31', hdgTrue: 148.2, hdgMag: 130.0, lengthFt: 7300, widthFt: 200, lat: 49.20055, lon: -123.19957, elevFt: 8, surface: 'concrete', toraFt: 7300, ldaFt: 7300,
          ils: { freq: 108.90, ident: 'IVV', course: 148.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '31', paired: '13', hdgTrue: 328.2, hdgMag: 310.0, lengthFt: 7300, widthFt: 200, lat: 49.18355, lon: -123.18343, elevFt: 7, surface: 'concrete', toraFt: 7300, ldaFt: 7300,
          ils: { freq: 111.70, ident: 'IVW', course: 328.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH54X' } }
      ]
    },
    {
      icao: 'CYUL', iata: 'YUL',
      name: 'Montreal Pierre Elliott Trudeau International Airport', nameZh: '蒙特利尔特鲁多国际机场',
      city: 'Montreal', cityZh: '蒙特利尔', country: 'Canada', countryZh: '加拿大',
      region: 'north-america', lat: 45.46784, lon: -73.74229, elevFt: 118, magVar: -15.1, tz: -5,
      transitionAltFt: 18000, size: 'large',
      runways: [
        { ident: '06L', paired: '24R', hdgTrue: 42.6, hdgMag: 57.7, lengthFt: 11000, widthFt: 200, lat: 45.46106, lon: -73.76501, elevFt: 96, surface: 'asphalt', toraFt: 11000, ldaFt: 11000,
          ils: { freq: 110.30, ident: 'IUL', course: 42.6, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '24R', paired: '06L', hdgTrue: 222.6, hdgMag: 237.7, lengthFt: 11000, widthFt: 200, lat: 45.48328, lon: -73.73592, elevFt: 106, surface: 'asphalt', toraFt: 11000, ldaFt: 11000,
          ils: { freq: 109.30, ident: 'IUM', course: 222.6, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } },
        { ident: '06R', paired: '24L', hdgTrue: 42.6, hdgMag: 57.7, lengthFt: 9600, widthFt: 200, lat: 45.45766, lon: -73.74139, elevFt: 98, surface: 'asphalt', toraFt: 9600, ldaFt: 9600,
          ils: { freq: 111.10, ident: 'IUN', course: 42.6, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '24L', paired: '06R', hdgTrue: 222.6, hdgMag: 237.7, lengthFt: 9600, widthFt: 200, lat: 45.47702, lon: -73.71601, elevFt: 117, surface: 'asphalt', toraFt: 9600, ldaFt: 9600,
          ils: { freq: 110.70, ident: 'IUO', course: 222.6, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } }
      ]
    },
    {
      icao: 'MMMX', iata: 'MEX',
      name: 'Mexico City Benito Juarez International Airport', nameZh: '墨西哥城贝尼托·华雷斯国际机场',
      city: 'Mexico City', cityZh: '墨西哥城', country: 'Mexico', countryZh: '墨西哥',
      region: 'north-america', lat: 19.43582, lon: -99.07033, elevFt: 7316, magVar: 5.6, tz: -6,
      transitionAltFt: 18000, size: 'large',
      runways: [
        { ident: '05L', paired: '23R', hdgTrue: 59.3, hdgMag: 53.7, lengthFt: 12966, widthFt: 148, lat: 19.42760, lon: -99.09050, elevFt: 7309, surface: 'asphalt', toraFt: 12966, ldaFt: 12966,
          ils: { freq: 110.30, ident: 'IMX', course: 59.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '23R', paired: '05L', hdgTrue: 239.3, hdgMag: 233.7, lengthFt: 12966, widthFt: 148, lat: 19.44570, lon: -99.05820, elevFt: 7311, surface: 'asphalt', toraFt: 12966, ldaFt: 12966,
          ils: { freq: 109.30, ident: 'INB', course: 239.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } },
        { ident: '05R', paired: '23L', hdgTrue: 59.2, hdgMag: 53.6, lengthFt: 12795, widthFt: 148, lat: 19.42700, lon: -99.08580, elevFt: 7316, surface: 'asphalt', toraFt: 12795, ldaFt: 12795,
          ils: { freq: 111.10, ident: 'INC', course: 59.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH48X' } },
        { ident: '23L', paired: '05R', hdgTrue: 239.2, hdgMag: 233.6, lengthFt: 12795, widthFt: 148, lat: 19.44490, lon: -99.05390, elevFt: 7295, surface: 'asphalt', toraFt: 12795, ldaFt: 12795,
          ils: { freq: 110.70, ident: 'IND', course: 239.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } }
      ]
    },
    /* ------------------------- 大洋洲 Oceania ------------------------- */
    {
      icao: 'YSSY', iata: 'SYD',
      name: 'Sydney Kingsford Smith Airport', nameZh: '悉尼金斯福德·史密斯机场',
      city: 'Sydney', cityZh: '悉尼', country: 'Australia', countryZh: '澳大利亚',
      region: 'oceania', lat: -33.94610, lon: 151.17700, elevFt: 21, magVar: 12.4, tz: 10,
      transitionAltFt: 10000, size: 'large',
      runways: [
        { ident: '07', paired: '25', hdgTrue: 82.4, hdgMag: 70.0, lengthFt: 8300, widthFt: 148, lat: -33.94210, lon: 151.16341, elevFt: 16, surface: 'asphalt', toraFt: 8300, ldaFt: 8300,
          ils: { freq: 111.10, ident: 'ISU', course: 82.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '25', paired: '07', hdgTrue: 262.4, hdgMag: 250.0, lengthFt: 8300, widthFt: 148, lat: -33.93909, lon: 151.19059, elevFt: 20, surface: 'asphalt', toraFt: 8300, ldaFt: 8300,
          ils: { freq: 110.70, ident: 'ISV', course: 262.4, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } },
        { ident: '16L', paired: '34R', hdgTrue: 167.0, hdgMag: 154.6, lengthFt: 7999, widthFt: 148, lat: -33.94960, lon: 151.18800, elevFt: 16, surface: 'asphalt', toraFt: 7999, ldaFt: 7999,
          ils: { freq: 108.90, ident: 'ISW', course: 167.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '34R', paired: '16L', hdgTrue: 347.0, hdgMag: 334.6, lengthFt: 7999, widthFt: 148, lat: -33.97110, lon: 151.19400, elevFt: 13, surface: 'asphalt', toraFt: 7999, ldaFt: 7999,
          ils: { freq: 111.70, ident: 'ISX', course: 347.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH54X' } },
        { ident: '16R', paired: '34L', hdgTrue: 167.9, hdgMag: 155.5, lengthFt: 12999, widthFt: 148, lat: -33.92940, lon: 151.17200, elevFt: 8, surface: 'asphalt', toraFt: 12999, ldaFt: 12999,
          ils: { freq: 110.30, ident: 'ISS', course: 167.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '34L', paired: '16R', hdgTrue: 347.9, hdgMag: 335.5, lengthFt: 12999, widthFt: 148, lat: -33.96430, lon: 151.18100, elevFt: 14, surface: 'asphalt', toraFt: 12999, ldaFt: 12999,
          ils: { freq: 109.30, ident: 'IST', course: 347.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } }
      ]
    },
    {
      icao: 'YMML', iata: 'MEL',
      name: 'Melbourne Airport', nameZh: '墨尔本机场',
      city: 'Melbourne', cityZh: '墨尔本', country: 'Australia', countryZh: '澳大利亚',
      region: 'oceania', lat: -37.67073, lon: 144.83790, elevFt: 434, magVar: 11.3, tz: 10,
      transitionAltFt: 10000, size: 'large',
      runways: [
        { ident: '09', paired: '27', hdgTrue: 101.3, hdgMag: 90.0, lengthFt: 7500, widthFt: 148, lat: -37.65954, lon: 144.82227, elevFt: 395, surface: 'asphalt', toraFt: 7500, ldaFt: 7500,
          ils: { freq: 111.10, ident: 'IMG', course: 101.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '27', paired: '09', hdgTrue: 281.3, hdgMag: 270.0, lengthFt: 7500, widthFt: 148, lat: -37.66356, lon: 144.84774, elevFt: 407, surface: 'asphalt', toraFt: 7500, ldaFt: 7500,
          ils: { freq: 110.70, ident: 'IMH', course: 281.3, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } },
        { ident: '16', paired: '34', hdgTrue: 171.7, hdgMag: 160.4, lengthFt: 11998, widthFt: 197, lat: -37.65320, lon: 144.83501, elevFt: 432, surface: 'asphalt', toraFt: 11998, ldaFt: 11998,
          ils: { freq: 110.30, ident: 'IMY', course: 171.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '34', paired: '16', hdgTrue: 351.7, hdgMag: 340.4, lengthFt: 11998, widthFt: 197, lat: -37.68580, lon: 144.84100, elevFt: 330, surface: 'asphalt', toraFt: 11998, ldaFt: 11998,
          ils: { freq: 109.30, ident: 'IMZ', course: 351.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } }
      ]
    },
    {
      icao: 'NZAA', iata: 'AKL',
      name: 'Auckland Airport', nameZh: '奥克兰机场',
      city: 'Auckland', cityZh: '奥克兰', country: 'New Zealand', countryZh: '新西兰',
      region: 'oceania', lat: -37.01199, lon: 174.78633, elevFt: 23, magVar: 19.3, tz: 12,
      transitionAltFt: 11000, size: 'large',
      runways: [
        { ident: '05R', paired: '23L', hdgTrue: 71.1, hdgMag: 51.8, lengthFt: 11926, widthFt: 148, lat: -37.01710, lon: 174.76700, elevFt: 15, surface: 'concrete', toraFt: 11926, ldaFt: 11926,
          ils: { freq: 109.30, ident: 'IAL', course: 71.1, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } },
        { ident: '23L', paired: '05R', hdgTrue: 251.1, hdgMag: 231.8, lengthFt: 11926, widthFt: 148, lat: -37.00670, lon: 174.80499, elevFt: 23, surface: 'concrete', toraFt: 11926, ldaFt: 11926,
          ils: { freq: 110.30, ident: 'IAK', course: 251.1, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } }
      ]
    },
    {
      icao: 'PHNL', iata: 'HNL',
      name: 'Daniel K. Inouye International Airport', nameZh: '檀香山丹尼尔·K·井上国际机场',
      city: 'Honolulu', cityZh: '檀香山', country: 'United States', countryZh: '美国',
      region: 'oceania', lat: 21.31839, lon: -157.92567, elevFt: 13, magVar: 9.6, tz: -10,
      transitionAltFt: 18000, size: 'large',
      runways: [
        { ident: '04L', paired: '22R', hdgTrue: 52.4, hdgMag: 42.8, lengthFt: 6955, widthFt: 150, lat: 21.31830, lon: -157.92300, elevFt: 10, surface: 'asphalt', toraFt: 6955, ldaFt: 6955,
          ils: null },
        { ident: '22R', paired: '04L', hdgTrue: 232.4, hdgMag: 222.8, lengthFt: 6955, widthFt: 150, lat: 21.32980, lon: -157.90700, elevFt: 10, surface: 'asphalt', toraFt: 6955, ldaFt: 6955,
          ils: null },
        { ident: '04R', paired: '22L', hdgTrue: 52.7, hdgMag: 43.1, lengthFt: 9002, widthFt: 150, lat: 21.31390, lon: -157.92700, elevFt: 9, surface: 'asphalt', toraFt: 9002, ldaFt: 9002,
          ils: { freq: 108.90, ident: 'IHR', course: 52.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH26X' } },
        { ident: '22L', paired: '04R', hdgTrue: 232.7, hdgMag: 223.1, lengthFt: 9002, widthFt: 150, lat: 21.32880, lon: -157.90601, elevFt: 9, surface: 'asphalt', toraFt: 9002, ldaFt: 9002,
          ils: { freq: 111.70, ident: 'IHS', course: 232.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH54X' } },
        { ident: '08L', paired: '26R', hdgTrue: 90.0, hdgMag: 80.4, lengthFt: 12360, widthFt: 200, lat: 21.32520, lon: -157.94299, elevFt: 12, surface: 'asphalt', toraFt: 12360, ldaFt: 12360,
          ils: { freq: 110.30, ident: 'IHN', course: 90.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '26R', paired: '08L', hdgTrue: 270.0, hdgMag: 260.4, lengthFt: 12360, widthFt: 200, lat: 21.32520, lon: -157.90700, elevFt: 9, surface: 'asphalt', toraFt: 12360, ldaFt: 12360,
          ils: null },
        { ident: '08R', paired: '26L', hdgTrue: 90.0, hdgMag: 80.4, lengthFt: 12000, widthFt: 200, lat: 21.30680, lon: -157.94600, elevFt: 10, surface: 'asphalt', toraFt: 12000, ldaFt: 12000,
          ils: { freq: 111.10, ident: 'IHP', course: 90.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH48X' } },
        { ident: '26L', paired: '08R', hdgTrue: 270.0, hdgMag: 260.4, lengthFt: 12000, widthFt: 200, lat: 21.30680, lon: -157.91100, elevFt: 10, surface: 'asphalt', toraFt: 12000, ldaFt: 12000,
          ils: { freq: 110.70, ident: 'IHQ', course: 270.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } }
      ]
    },
    /* ------------------------- 南美洲 South America ------------------------- */
    {
      icao: 'SBGR', iata: 'GRU',
      name: 'Sao Paulo/Guarulhos International Airport', nameZh: '圣保罗瓜鲁柳斯国际机场',
      city: 'Sao Paulo', cityZh: '圣保罗', country: 'Brazil', countryZh: '巴西',
      region: 'south-america', lat: -23.43127, lon: -46.46995, elevFt: 2461, magVar: -20.0, tz: -3,
      transitionAltFt: 6000, size: 'large',
      runways: [
        { ident: '10L', paired: '28R', hdgTrue: 80.0, hdgMag: 100.0, lengthFt: 12139, widthFt: 148, lat: -23.43244, lon: -46.48373, elevFt: 2445, surface: 'asphalt', toraFt: 12139, ldaFt: 12139,
          ils: { freq: 110.30, ident: 'IGR', course: 80.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '28R', paired: '10L', hdgTrue: 260.0, hdgMag: 280.0, lengthFt: 12139, widthFt: 148, lat: -23.42666, lon: -46.44802, elevFt: 2440, surface: 'asphalt', toraFt: 12139, ldaFt: 12139,
          ils: { freq: 109.30, ident: 'IGS', course: 260.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } },
        { ident: '10R', paired: '28L', hdgTrue: 80.0, hdgMag: 100.0, lengthFt: 9843, widthFt: 148, lat: -23.43734, lon: -46.48743, elevFt: 2450, surface: 'asphalt', toraFt: 9843, ldaFt: 9843,
          ils: { freq: 111.10, ident: 'IGT', course: 80.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '28L', paired: '10R', hdgTrue: 260.0, hdgMag: 280.0, lengthFt: 9843, widthFt: 148, lat: -23.43266, lon: -46.45847, elevFt: 2445, surface: 'asphalt', toraFt: 9843, ldaFt: 9843,
          ils: { freq: 110.70, ident: 'IGU', course: 260.0, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } }
      ]
    },
    {
      icao: 'SCEL', iata: 'SCL',
      name: 'Santiago Arturo Merino Benitez International Airport', nameZh: '圣地亚哥阿图罗·梅里诺·贝尼特斯国际机场',
      city: 'Santiago', cityZh: '圣地亚哥', country: 'Chile', countryZh: '智利',
      region: 'south-america', lat: -33.39300, lon: -70.78580, elevFt: 1555, magVar: 3.4, tz: -4,
      transitionAltFt: 12000, size: 'large',
      runways: [
        { ident: '17L', paired: '35R', hdgTrue: 177.9, hdgMag: 174.5, lengthFt: 12303, widthFt: 180, lat: -33.37610, lon: -70.78670, elevFt: 1550, surface: 'asphalt', toraFt: 12303, ldaFt: 12303,
          ils: { freq: 110.30, ident: 'ISC', course: 177.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH40X' } },
        { ident: '35R', paired: '17L', hdgTrue: 357.9, hdgMag: 354.5, lengthFt: 12303, widthFt: 180, lat: -33.40990, lon: -70.78520, elevFt: 1555, surface: 'asphalt', toraFt: 12303, ldaFt: 12303,
          ils: { freq: 109.30, ident: 'ISD', course: 357.9, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } },
        { ident: '17R', paired: '35L', hdgTrue: 177.5, hdgMag: 174.1, lengthFt: 12303, widthFt: 148, lat: -33.37190, lon: -70.80370, elevFt: 1551, surface: 'asphalt', toraFt: 12303, ldaFt: 12303,
          ils: { freq: 111.10, ident: 'ISE', course: 177.5, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '35L', paired: '17R', hdgTrue: 357.5, hdgMag: 354.1, lengthFt: 12303, widthFt: 148, lat: -33.40690, lon: -70.80190, elevFt: 1550, surface: 'asphalt', toraFt: 12303, ldaFt: 12303,
          ils: { freq: 110.70, ident: 'ISF', course: 357.5, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } }
      ]
    },
    /* ------------------------- 非洲 Africa ------------------------- */
    {
      icao: 'FACT', iata: 'CPT',
      name: 'Cape Town International Airport', nameZh: '开普敦国际机场',
      city: 'Cape Town', cityZh: '开普敦', country: 'South Africa', countryZh: '南非',
      region: 'africa', lat: -33.97403, lon: 18.60433, elevFt: 151, magVar: -24.1, tz: 2,
      transitionAltFt: 10000, size: 'large',
      runways: [
        { ident: '01', paired: '19', hdgTrue: 345.2, hdgMag: 9.3, lengthFt: 10502, widthFt: 200, lat: -33.98770, lon: 18.60890, elevFt: 144, surface: 'asphalt', toraFt: 10502, ldaFt: 10502,
          ils: { freq: 109.30, ident: 'ICG', course: 345.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH30X' } },
        { ident: '19', paired: '01', hdgTrue: 165.2, hdgMag: 189.3, lengthFt: 10502, widthFt: 200, lat: -33.95980, lon: 18.60000, elevFt: 147, surface: 'asphalt', toraFt: 10502, ldaFt: 10502,
          ils: { freq: 110.30, ident: 'ICF', course: 165.2, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH40X' } },
        { ident: '16', paired: '34', hdgTrue: 135.5, hdgMag: 159.6, lengthFt: 5581, widthFt: 151, lat: -33.96140, lon: 18.59750, elevFt: 143, surface: 'asphalt', toraFt: 5581, ldaFt: 5581,
          ils: { freq: 111.10, ident: 'ICH', course: 135.5, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '34', paired: '16', hdgTrue: 315.5, hdgMag: 339.6, lengthFt: 5581, widthFt: 151, lat: -33.97230, lon: 18.61040, elevFt: 151, surface: 'asphalt', toraFt: 5581, ldaFt: 5581,
          ils: { freq: 110.70, ident: 'ICI', course: 315.5, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } }
      ]
    },
    {
      icao: 'FAOR', iata: 'JNB',
      name: 'O.R. Tambo International Airport', nameZh: '约翰内斯堡奥利弗·坦博国际机场',
      city: 'Johannesburg', cityZh: '约翰内斯堡', country: 'South Africa', countryZh: '南非',
      region: 'africa', lat: -26.14008, lon: 28.24680, elevFt: 5558, magVar: -17.5, tz: 2,
      transitionAltFt: 12000, size: 'large',
      runways: [
        { ident: '03L', paired: '21R', hdgTrue: 15.7, hdgMag: 33.2, lengthFt: 14495, widthFt: 200, lat: -26.14630, lon: 28.23430, elevFt: 5558, surface: 'asphalt', toraFt: 14495, ldaFt: 14495,
          ils: { freq: 110.30, ident: 'IJN', course: 15.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT III', dmeChannel: 'CH40X' } },
        { ident: '21R', paired: '03L', hdgTrue: 195.7, hdgMag: 213.2, lengthFt: 14495, widthFt: 200, lat: -26.10800, lon: 28.24630, elevFt: 5501, surface: 'asphalt', toraFt: 14495, ldaFt: 14495,
          ils: { freq: 109.30, ident: 'IJO', course: 195.7, gsAngle: 3.00, gsDistNm: 12, type: 'CAT II', dmeChannel: 'CH30X' } },
        { ident: '03R', paired: '21L', hdgTrue: 15.5, hdgMag: 33.0, lengthFt: 11155, widthFt: 197, lat: -26.16470, lon: 28.24820, elevFt: 5510, surface: 'asphalt', toraFt: 11155, ldaFt: 11155,
          ils: { freq: 111.10, ident: 'IJP', course: 15.5, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH48X' } },
        { ident: '21L', paired: '03R', hdgTrue: 195.5, hdgMag: 213.0, lengthFt: 11155, widthFt: 197, lat: -26.13520, lon: 28.25730, elevFt: 5494, surface: 'asphalt', toraFt: 11155, ldaFt: 11155,
          ils: { freq: 110.70, ident: 'IJQ', course: 195.5, gsAngle: 3.00, gsDistNm: 12, type: 'CAT I', dmeChannel: 'CH44X' } }
      ]
    }
  ];

  /* ========================================================================
     索引与查询 (FS.Airports)
     ======================================================================== */
  var BY_ICAO = {};
  var BY_IATA = {};
  var ALL_RUNWAYS = [];      /* 全部跑道端, 附加 airportIcao / rwyIndex */
  var ILS_RUNWAYS = [];
  var HAYSTACK = [];         /* 与 FS.AIRPORTS 同序的检索用字符串 */
  var ILS_LIST = null;
  var AP = FS.AIRPORTS;
  var i, j, ap, rwy;

  for (i = 0; i < AP.length; i++) {
    ap = AP[i];
    if (ap.icao) { BY_ICAO[String(ap.icao).toUpperCase()] = ap; }
    if (ap.iata) { BY_IATA[String(ap.iata).toUpperCase()] = ap; }
    HAYSTACK.push((ap.icao + ' ' + ap.iata + ' ' + ap.name + ' ' + ap.nameZh + ' ' +
      ap.city + ' ' + ap.cityZh + ' ' + ap.country + ' ' + ap.countryZh).toLowerCase());
    for (j = 0; j < ap.runways.length; j++) {
      rwy = ap.runways[j];
      rwy.airportIcao = ap.icao;
      rwy.rwyIndex = j;
      ALL_RUNWAYS.push(rwy);
      if (rwy.ils) { ILS_RUNWAYS.push(rwy); }
    }
  }

  /** 统一代码格式(去空格、转大写) */
  function normCode(v) {
    return (v === null || v === undefined) ? '' : String(v).replace(/^\s+|\s+$/g, '').toUpperCase();
  }

  /** 跑道编号归一: '6L' -> '06L' */
  function normRwyIdent(v) {
    var s = normCode(v);
    return /^\d[LRC]?$/.test(s) ? ('0' + s) : s;
  }

  /** 跑道编号数字部分: '17R' -> 17 */
  function identNo(id) {
    var m = /^(\d{1,2})/.exec(String(id));
    return m ? parseInt(m[1], 10) : null;
  }

  FS.Airports = {
    list: AP,

    /** ICAO 代码查询 (大小写不敏感) */
    byIcao: function (icao) {
      return BY_ICAO[normCode(icao)];
    },

    /** IATA 代码查询 (大小写不敏感) */
    byIata: function (iata) {
      return BY_IATA[normCode(iata)];
    },

    /** 模糊检索: ICAO/IATA/英文名/中文名/城市(中英), 子串匹配, 大小写不敏感 */
    search: function (q) {
      var s = (q === null || q === undefined) ? '' : String(q).replace(/^\s+|\s+$/g, '').toLowerCase();
      if (!s) { return AP.slice(); }
      var out = [];
      for (var k = 0; k < AP.length; k++) {
        if (HAYSTACK[k].indexOf(s) >= 0) { out.push(AP[k]); }
      }
      return out;
    },

    /** 距离给定位置最近的机场 -> {airport, distNm} 或 null */
    nearest: function (lat, lon, maxNm) {
      var la = Number(lat), lo = Number(lon);
      if (!isFinite(la) || !isFinite(lo)) { return null; }
      var limit = (maxNm === undefined || maxNm === null || !isFinite(Number(maxNm)))
        ? Infinity : Number(maxNm);
      var best = null, bestD = Infinity, d, k;
      for (k = 0; k < AP.length; k++) {
        d = FS.Geo.greatCircleNm(la, lo, AP[k].lat, AP[k].lon);
        if (d < bestD) { bestD = d; best = AP[k]; }
      }
      if (!best || bestD > limit) { return null; }
      return { airport: best, distNm: bestD };
    },

    /**
     * 跑道端列表. 不传参数 -> 全部跑道端(扁平数组, 带 airportIcao/rwyIndex);
     * 传 ICAO -> 该机场的 runways 数组.
     * 返回的是内部对象引用, 请勿修改.
     */
    allRunways: function (icao) {
      if (icao === undefined || icao === null || icao === '') { return ALL_RUNWAYS; }
      var a = BY_ICAO[normCode(icao)];
      return a ? a.runways : [];
    },

    /** 按 ICAO + 跑道端编号查跑道 (大小写不敏感, '6L' 等价 '06L') -> runway 或 null */
    findRunway: function (icao, ident) {
      var a = BY_ICAO[normCode(icao)];
      if (!a) { return null; }
      var want = normRwyIdent(ident);
      if (!want) { return null; }
      for (var k = 0; k < a.runways.length; k++) {
        if (normRwyIdent(a.runways[k].ident) === want) { return a.runways[k]; }
      }
      return null;
    },

    /**
     * 设置 Geo 参考点并返回跑道在世界坐标下的几何.
     * useCurrentRef 为真时沿用调用方当前参考点, 不修改 Geo.
     * 返回 { airport, runway, threshold:{x,z}, end:{x,z}, center:{x,z},
     *        hdgTrue, lengthM, widthM, elevM, ils } 或 null
     */
    runwayWorldGeometry: function (icao, ident, useCurrentRef) {
      var a = BY_ICAO[normCode(icao)];
      var r = FS.Airports.findRunway(icao, ident);
      if (!a || !r) { return null; }
      var Geo = FS.Geo;
      var lengthM = r.lengthFt * 0.3048;
      /* 先在经纬度域推算跑道另一端, 再切参考点(顺序不可颠倒) */
      var endLL = Geo.greatCircleOffset(r.lat, r.lon, r.hdgTrue, lengthM);
      var savedLat = Geo.refLat, savedLon = Geo.refLon, savedCos = Geo.cosRef;
      if (!useCurrentRef) { Geo.setReference(a.lat, a.lon); }
      try {
        var th = Geo.toWorld(r.lat, r.lon);
        var en = Geo.toWorld(endLL.lat, endLL.lon);
        return {
          airport: a,
          runway: r,
          threshold: { x: th.x, z: th.z },
          end: { x: en.x, z: en.z },
          center: { x: (th.x + en.x) * 0.5, z: (th.z + en.z) * 0.5 },
          hdgTrue: r.hdgTrue,
          lengthM: lengthM,
          widthM: r.widthFt * 0.3048,
          elevM: r.elevFt * 0.3048,
          ils: r.ils
        };
      } finally {
        Geo.refLat = savedLat;
        Geo.refLon = savedLon;
        Geo.cosRef = savedCos;
      }
    },

    /**
     * 完整 ILS 进近数据(世界坐标). 该跑道端无 ILS 时返回 null.
     * glidePathAt(distNmFromThreshold) -> 距入口该距离处的水上高度(英尺 AGL)
     */
    ilsWorld: function (icao, ident, useCurrentRef) {
      var g = FS.Airports.runwayWorldGeometry(icao, ident, useCurrentRef);
      if (!g || !g.ils) { return null; }
      var ils = g.ils;
      var tanGs = Math.tan(U.rad(ils.gsAngle));
      var gsDistNm = (ils.gsDistNm === undefined || ils.gsDistNm === null) ? 12 : ils.gsDistNm;
      return {
        runway: g.runway,
        center: g.center,
        threshold: g.threshold,
        course: ils.course,
        gsAngle: ils.gsAngle,
        gsDistM: gsDistNm * 1852,
        gsDistNm: gsDistNm,
        freqMHz: ils.freq,
        identStr: ils.ident,
        catType: ils.type,
        dmeChannel: ils.dmeChannel,
        /** 距入口 distNmFromThreshold 海里处, 沿下滑道的高度(英尺 AGL) */
        glidePathAt: function (distNmFromThreshold) {
          var d = Number(distNmFromThreshold);
          if (!isFinite(d) || d < 0) { d = 0; }
          return (d * 1852 * tanGs) / 0.3048;
        }
      };
    },

    /** 全部带 ILS 的跑道端, 按 ICAO + 编号排序, 供菜单使用 */
    ilsList: function () {
      if (ILS_LIST) { return ILS_LIST; }
      var out = [];
      for (var k = 0; k < ALL_RUNWAYS.length; k++) {
        var r = ALL_RUNWAYS[k];
        if (!r.ils) { continue; }
        var a = BY_ICAO[r.airportIcao];
        out.push({
          icao: r.airportIcao,
          ident: r.ident,
          paired: r.paired,
          freq: r.ils.freq,
          ilsIdent: r.ils.ident,
          course: r.ils.course,
          gsAngle: r.ils.gsAngle,
          gsDistNm: r.ils.gsDistNm,
          type: r.ils.type,
          dmeChannel: r.ils.dmeChannel,
          airportName: a.name,
          nameZh: a.nameZh,
          city: a.city,
          cityZh: a.cityZh,
          region: a.region,
          lengthFt: r.lengthFt,
          elevFt: r.elevFt,
          rwyIndex: r.rwyIndex
        });
      }
      out.sort(function (x, y) {
        if (x.icao !== y.icao) { return x.icao < y.icao ? -1 : 1; }
        if (x.ident !== y.ident) { return x.ident < y.ident ? -1 : 1; }
        return 0;
      });
      ILS_LIST = out;
      return ILS_LIST;
    },

    /** 统计 -> {airports, runways, ils} */
    stats: function () {
      return { airports: AP.length, runways: ALL_RUNWAYS.length, ils: ILS_RUNWAYS.length };
    }
  };

  /* 启动自检: FS.CFG.defaultAirports 必须全部存在 */
  (function () {
    var defs = FS.CFG && FS.CFG.defaultAirports;
    if (!defs) { return; }
    var miss = [];
    for (var k = 0; k < defs.length; k++) {
      if (!BY_ICAO[normCode(defs[k])]) { miss.push(defs[k]); }
    }
    if (miss.length) { FS.Log.warn('airports.js: 缺少默认机场 ' + miss.join(', ')); }
  })();

  FS.Log.info('airports.js 已加载 — ' + AP.length + ' 个机场 (' + ALL_RUNWAYS.length +
    ' 条跑道 / ' + ILS_RUNWAYS.length + ' 套 ILS)');

})(typeof window !== 'undefined' ? window : globalThis);
