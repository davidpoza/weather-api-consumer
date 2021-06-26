const Fs = require('fs');
const air = require('aire-madrid');
const Utils = require('./utils');
const { LEVEL_1, LEVEL_2, LEVEL_3 } = require('./constants');

const spyCalculateScene = jest.spyOn(Utils, 'calculateScene');
const spyUploadFile = jest.spyOn(Utils, 'uploadFile').mockImplementation(() => {});
const spyReadFileSync= jest.spyOn(Fs, 'readFileSync').mockImplementation(() => {});
const spyWriteFileSync= jest.spyOn(Fs, 'writeFileSync').mockImplementation(() => {});
const spyUnlinkSync= jest.spyOn(Fs, 'unlinkSync').mockImplementation(() => {});
const spyExistsSync = jest.spyOn(Fs, 'existsSync');
const spyJsonParse = jest.spyOn(JSON, 'parse');
const spyGetReadings = jest.spyOn(air, 'getReadings');

function initializeZones() {
  const result = {};
  ['zone1', 'zone2', 'zone3', 'zone4', 'zone5'].forEach(z => {
    result[z] = {};
    result[z][LEVEL_1] = 0;
    result[z][LEVEL_2] = 0;
    result[z][LEVEL_3] = 0;
  });
  return result;
}

describe('calculateScene', () => {
  it('scene 0 if no stations on level 1, 2 o 3', () => {
    const totalStationsByZone = initializeZones();
    const totalStationsByZoneYes = initializeZones();
    const totalStationsByZoneBefYes = initializeZones();
    const totalStationsByZoneBefBefYes = initializeZones();
    expect(Utils.calculateScene(
      totalStationsByZone, totalStationsByZoneYes, totalStationsByZoneBefYes, totalStationsByZoneBefBefYes
    )).toBe(0);
  });

  it('scene 1 if one day on level 1 on 2 o more stations on same zone', () => {
    const totalStationsByZone = initializeZones();
    const totalStationsByZoneYes = initializeZones();
    const totalStationsByZoneBefYes = initializeZones();
    const totalStationsByZoneBefBefYes = initializeZones();
    totalStationsByZone['zone1'][LEVEL_1] = 2;
    expect(Utils.calculateScene(
      totalStationsByZone, totalStationsByZoneYes, totalStationsByZoneBefYes, totalStationsByZoneBefBefYes
    )).toBe(1);
  });

  it('scene 2 if two days on level 1 or one day on level 2, for two or more stations on same zone', () => {
    let totalStationsByZone = initializeZones();
    const totalStationsByZoneYes = initializeZones();
    const totalStationsByZoneBefYes = initializeZones();
    const totalStationsByZoneBefBefYes = initializeZones();

    totalStationsByZone['zone1'][LEVEL_2] = 2;
    expect(Utils.calculateScene(
      totalStationsByZone, totalStationsByZoneYes, totalStationsByZoneBefYes, totalStationsByZoneBefBefYes
      )).toBe(2);

    totalStationsByZone = initializeZones();

    totalStationsByZone['zone1'][LEVEL_1] = 2;
    totalStationsByZoneYes['zone1'][LEVEL_1] = 2;
    expect(Utils.calculateScene(
      totalStationsByZone, totalStationsByZoneYes, totalStationsByZoneBefYes, totalStationsByZoneBefBefYes
    )).toBe(2);
  });

  it('scene 3 if three days on level 1 or two days on level 2, for two or more stations on same zone', () => {
    let totalStationsByZone = initializeZones();
    const totalStationsByZoneYes = initializeZones();
    const totalStationsByZoneBefYes = initializeZones();
    const totalStationsByZoneBefBefYes = initializeZones();

    totalStationsByZone['zone1'][LEVEL_2] = 2;
    totalStationsByZoneYes['zone1'][LEVEL_2] = 2;
    expect(Utils.calculateScene(
      totalStationsByZone, totalStationsByZoneYes, totalStationsByZoneBefYes, totalStationsByZoneBefBefYes
      )).toBe(3);

    totalStationsByZone = initializeZones();

    totalStationsByZone['zone1'][LEVEL_1] = 2;
    totalStationsByZoneYes['zone1'][LEVEL_1] = 2;
    totalStationsByZoneBefYes['zone1'][LEVEL_1] = 2;
    expect(Utils.calculateScene(
      totalStationsByZone, totalStationsByZoneYes, totalStationsByZoneBefYes, totalStationsByZoneBefBefYes
    )).toBe(3);
  });

  it('scene 4 if four days on level 2, for two or more stations on same zone', () => {
    const totalStationsByZone = initializeZones();
    const totalStationsByZoneYes = initializeZones();
    const totalStationsByZoneBefYes = initializeZones();
    const totalStationsByZoneBefBefYes = initializeZones();

    totalStationsByZone['zone1'][LEVEL_2] = 2;
    totalStationsByZoneYes['zone1'][LEVEL_2] = 2;
    totalStationsByZoneBefYes['zone1'][LEVEL_2] = 2;
    totalStationsByZoneBefBefYes['zone1'][LEVEL_2] = 2;
    expect(Utils.calculateScene(
      totalStationsByZone, totalStationsByZoneYes, totalStationsByZoneBefYes, totalStationsByZoneBefBefYes
      )).toBe(4);
  });

  it('scene 5 one day on level 3, for three or more stations on same zone', () => {
    const totalStationsByZone = initializeZones();
    const totalStationsByZoneYes = initializeZones();
    const totalStationsByZoneBefYes = initializeZones();
    const totalStationsByZoneBefBefYes = initializeZones();

    totalStationsByZone['zone1'][LEVEL_3] = 3;

    expect(Utils.calculateScene(
      totalStationsByZone, totalStationsByZoneYes, totalStationsByZoneBefYes, totalStationsByZoneBefBefYes
      )).toBe(5);
  });
});

describe('calculatePollution', () => {
  beforeEach(() => {
    spyExistsSync.mockReturnValue(true);
  });
  afterEach(() => {
    spyCalculateScene.mockClear();
  });

  it('level 0 for all stations', async () => {
    spyGetReadings
      .mockReturnValueOnce([ //today for zone 5
        {
          id: '17',
          pollutants: [ {
            values: [
              68, 72, 78, 77, 76, 68, 50,
              53, 32, 23, 17, 14, 16, 20,
              19, 16, 14
            ],
          }],
        },
        {
          id: '18',
          pollutants: [ {
            values: [
              68, 72, 78, 77, 76, 68, 50,
              53, 32, 23, 17, 14, 16, 20,
              19, 16, 14
            ],
          }],
        },
      ])
      .mockReturnValue([]);

  spyJsonParse
    .mockReturnValueOnce(initializeZones()) // yesterday
    .mockReturnValueOnce(initializeZones()) // before yesterday
    .mockReturnValueOnce(initializeZones()) // bb yesterday

    await Utils.calculatePollution();
    const today = initializeZones();
    const yesterday = initializeZones();
    const bYesterday = initializeZones();
    const bbYesterday= initializeZones();
    expect(spyCalculateScene).toBeCalledWith(
      today,
      yesterday,
      bYesterday,
      bbYesterday
    );
  });

  it('two stations, two times in a row, with values higher than 180', async () => {
    spyGetReadings
      .mockReturnValueOnce([ //today for zone 1
        {
          id: '1',
          pollutants: [ {
            values: [
              68, 72, 78, 77, 76, 68, 50,
              53, 181, 183, 17, 14, 16, 20,
              19, 16, 14
            ],
          }],
        },
        {
          id: '2',
          pollutants: [ {
            values: [
              68, 72, 78, 77, 76, 68, 50,
              53, 32, 23, 17, 14, 182, 190,
              19, 16, 14
            ],
          }],
        },
      ])
      .mockReturnValue([]);

  spyJsonParse
    .mockReturnValueOnce(initializeZones()) // yesterday
    .mockReturnValueOnce(initializeZones()) // before yesterday
    .mockReturnValueOnce(initializeZones()) // bb yesterday

    await Utils.calculatePollution();
    const today = initializeZones();
    const yesterday = initializeZones();
    const bYesterday = initializeZones();
    const bbYesterday= initializeZones();
    today['zone1'][LEVEL_1] = 2;
    expect(spyCalculateScene).toBeCalledWith(
      today,
      yesterday,
      bYesterday,
      bbYesterday
    );
  });

  it('two stations, three times in a row, with values higher than 200', async () => {
    spyGetReadings
      .mockReturnValueOnce([ //today for zone 1
        {
          id: '1',
          pollutants: [ {
            values: [
              68, 72, 78, 77, 76, 68, 50,
              53, 201, 222, 224, 14, 16, 20,
              19, 16, 14
            ],
          }],
        },
        {
          id: '2',
          pollutants: [ {
            values: [
              68, 72, 78, 77, 76, 68, 50,
              53, 32, 23, 17, 14, 221, 230,
              240, 16, 14
            ],
          }],
        },
      ])
      .mockReturnValue([]);

  spyJsonParse
    .mockReturnValueOnce(initializeZones()) // yesterday
    .mockReturnValueOnce(initializeZones()) // before yesterday
    .mockReturnValueOnce(initializeZones()) // bb yesterday

    await Utils.calculatePollution();
    const today = initializeZones();
    const yesterday = initializeZones();
    const bYesterday = initializeZones();
    const bbYesterday= initializeZones();
    today['zone1'][LEVEL_2] = 2;
    expect(spyCalculateScene).toBeCalledWith(
      today,
      yesterday,
      bYesterday,
      bbYesterday
    );
  });

  it('three stations, three times in a row, with values higher than 400', async () => {
    spyGetReadings
      .mockReturnValueOnce([ //today for zone 1
        {
          id: '1',
          pollutants: [ {
            values: [
              68, 72, 78, 77, 76, 68, 50,
              53, 401, 402, 403, 14, 16, 20,
              19, 16, 14
            ],
          }],
        },
        {
          id: '2',
          pollutants: [ {
            values: [
              68, 72, 78, 77, 76, 68, 50,
              53, 401, 402, 403, 14, 221, 230,
              240, 16, 14
            ],
          }],
        },
        {
          id: '3',
          pollutants: [ {
            values: [
              68, 72, 78, 77, 76, 68, 50,
              53, 401, 402, 403, 14, 221, 230,
              240, 16, 14
            ],
          }],
        },
      ])
      .mockReturnValue([]);

  spyJsonParse
    .mockReturnValueOnce(initializeZones()) // yesterday
    .mockReturnValueOnce(initializeZones()) // before yesterday
    .mockReturnValueOnce(initializeZones()) // bb yesterday

    await Utils.calculatePollution();
    const today = initializeZones();
    const yesterday = initializeZones();
    const bYesterday = initializeZones();
    const bbYesterday= initializeZones();
    today['zone1'][LEVEL_3] = 3;
    expect(spyCalculateScene).toBeCalledWith(
      today,
      yesterday,
      bYesterday,
      bbYesterday
    );
  });

  it('three stations, two times in a row, with values higher than 400 (for zone4)', async () => {
    spyGetReadings
      .mockReturnValueOnce([])
      .mockReturnValueOnce([])
      .mockReturnValueOnce([])
      .mockReturnValueOnce([ //today for zone 4
        {
          id: '1',
          pollutants: [ {
            values: [
              68, 72, 78, 77, 76, 68, 50,
              53, 401, 402, 200, 14, 16, 20,
              19, 16, 14
            ],
          }],
        },
        {
          id: '2',
          pollutants: [ {
            values: [
              68, 72, 78, 77, 76, 68, 50,
              53, 401, 402, 200, 14, 221, 230,
              240, 16, 14
            ],
          }],
        },
        {
          id: '3',
          pollutants: [ {
            values: [
              68, 72, 78, 77, 76, 68, 50,
              53, 401, 402, 200, 14, 221, 230,
              240, 16, 14
            ],
          }],
        },
      ])
      .mockReturnValue([]);

  spyJsonParse
    .mockReturnValueOnce(initializeZones()) // yesterday
    .mockReturnValueOnce(initializeZones()) // before yesterday
    .mockReturnValueOnce(initializeZones()) // bb yesterday

    await Utils.calculatePollution();
    const today = initializeZones();
    const yesterday = initializeZones();
    const bYesterday = initializeZones();
    const bbYesterday= initializeZones();
    today['zone4'][LEVEL_3] = 3;
    expect(spyCalculateScene).toBeCalledWith(
      today,
      yesterday,
      bYesterday,
      bbYesterday
    );
  });
});