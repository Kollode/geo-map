import { loadMapApi } from './load-map-api';
import * as Test from '../test';
import * as Types from '../types';

const auth: Types.GoogleMapApiKeyAuth = {
  apiKey: Test.Constants.GOOGLE_MAP_API
};

test('returns a failure map result for faulty map provider', async () => {
  // tslint:disable-next-line:no-any
  const mapResult = await loadMapApi({ provider: 'Algolia' } as any, {});
  expect(mapResult.result.type).toBe(Types.ResultType.Failure);
});

test(
  'returns the passed map provider for Google',
  Test.domContextify(async context => {
    const googleResult = await loadMapApi({
      browserCtx: context,
      // mapJsUrl: 'file:///home/menabe/Software/s2/geo-map/x.js',
      // mapJsCallbackId: 'g842a34aeb4c84c358ff3e877216c72c3',
      provider: Types.GeoMapProvider.Google,
      auth
    });
    expect(googleResult.provider).toBe(Types.GeoMapProvider.Google);
  })
);

test(
  'returns the passed map provider for HERE',
  Test.domContextify(async context => {
    // tslint:disable-next-line:no-any
    (context as any).H = Test.createHMock();

    const hereResult = await loadMapApi({
      browserCtx: context,
      provider: Types.GeoMapProvider.Here,
      appCode: Test.Constants.HERE_APP_CODE,
      appId: Test.Constants.HERE_APP_ID
    });
    expect(hereResult.provider).toBe(Types.GeoMapProvider.Here);
  })
);

test(
  'injects a script tag for google',
  Test.domContextify(async context => {
    await loadMapApi({
      browserCtx: context,
      provider: Types.GeoMapProvider.Google,
      auth
    });

    const scripts = context.window.document.querySelectorAll(
      `script[data-map-provider=${Types.GeoMapProvider.Google}]`
    );
    expect(scripts).toHaveLength(1);
  })
);

test(
  'injects no more than one script tag for google parallely',
  Test.domContextify(async context => {
    await Promise.all([
      loadMapApi({
        browserCtx: context,
        provider: Types.GeoMapProvider.Google,
        auth
      }),
      loadMapApi({
        browserCtx: context,
        provider: Types.GeoMapProvider.Google,
        auth
      })
    ]);

    const scripts = context.window.document.querySelectorAll(
      `script[data-map-provider=${Types.GeoMapProvider.Google}]`
    );
    expect(scripts).toHaveLength(1);
  })
);

test(
  'injects no more than one script tag for google sequentially',
  Test.domContextify(async context => {
    await loadMapApi({
      browserCtx: context,
      provider: Types.GeoMapProvider.Google,
      auth
    });
    await loadMapApi({
      browserCtx: context,
      provider: Types.GeoMapProvider.Google,
      auth
    });

    const scripts = context.window.document.querySelectorAll(
      `script[data-map-provider=${Types.GeoMapProvider.Google}]`
    );
    expect(scripts).toHaveLength(1);
  })
);

test(
  'injects three script tags for here',
  Test.domContextify(async context => {
    // tslint:disable-next-line:no-any
    (context.window as any).H = Test.createHMock();

    await loadMapApi({
      browserCtx: context,
      provider: Types.GeoMapProvider.Here,
      appCode: Test.Constants.HERE_APP_CODE,
      appId: Test.Constants.HERE_APP_ID
    });

    const scripts = context.window.document.querySelectorAll(
      `script[data-map-provider=${Types.GeoMapProvider.Here}]`
    );
    expect(scripts).toHaveLength(3);
  })
);

test(
  'injects no more than three script tags for here',
  Test.domContextify(async context => {
    // tslint:disable-next-line:no-any
    (context.window as any).H = Test.createHMock();

    await loadMapApi({
      browserCtx: context,
      provider: Types.GeoMapProvider.Here,
      appCode: Test.Constants.HERE_APP_CODE,
      appId: Test.Constants.HERE_APP_ID
    });
    await loadMapApi({
      browserCtx: context,
      provider: Types.GeoMapProvider.Here,
      appCode: Test.Constants.HERE_APP_CODE,
      appId: Test.Constants.HERE_APP_ID
    });

    const scripts = context.window.document.querySelectorAll(
      `script[data-map-provider=${Types.GeoMapProvider.Here}]`
    );
    expect(scripts).toHaveLength(3);
  })
);
