import { GeoMarker } from './geo-marker';
import { GeoMarkerHere } from './geo-marker-here';
import { GeoMapPhases } from './geo-map-phases';
import { GeoRectHere } from './geo-rect-here';
import { loadMapApi } from './load-map-api';
import * as Types from './types';
import { RSA_NO_PADDING } from 'constants';
import { threadId } from 'worker_threads';

export interface GeoMapHereInit {
  config: Types.LoadHereMapConfig;
  geoMapCtx?: Types.GeoMapContext;
}

export class GeoMapHere implements Types.GeoMapImplementation {
  public api?: Types.HereApi;
  public map?: H.Map;
  public readonly markers: GeoMarkerHere[] = [];
  public platform: H.service.Platform;

  private layer: Types.GeoLayer = Types.GeoLayer.None;
  // private tainted: boolean;
  private readonly window: Types.GeoMapWindow;
  private readonly config: Types.LoadHereMapConfig;
  private mapType: Types.GeoMapType = Types.GeoMapType.Unknown;
  private phases: GeoMapPhases = new GeoMapPhases();

  // private handlers: Map<Types.GeoEvent, ((e?: Event) => void)[]> = new Map();

  public constructor(init: GeoMapHereInit) {
    this.config = init.config;
    this.window = init.config.browserCtx.window;
    this.phases.resolve(Types.GeoMapPhase.Pristine);
  }

  // public fire(eventName: Types.GeoEvent, e?: Event): void {
  //   const handlers = this.handlers.get(eventName) || [];
  //   handlers.forEach(h => h(e));
  // }

  private async waitForChangeEvent(
    action: (
      rs?: (m: void | PromiseLike<void>) => void,
      rj?: (t?: any) => void
    ) => void
  ): Promise<void> {
    return new Promise(async (rs, rj) => {
      const onMapViewChangedEnd = () => {
        this.map.removeEventListener('mapviewchangeend', onMapViewChangedEnd);
        rs();
      };
      this.map.addEventListener('mapviewchangeend', onMapViewChangedEnd);
      try {
        await action(onMapViewChangedEnd, () => {
          this.map.removeEventListener('mapviewchangeend', onMapViewChangedEnd);
          rj();
        });
      } catch (e) {
        this.map.removeEventListener('mapviewchangeend', onMapViewChangedEnd);
        rj(e);
      }
    });
  }

  public async load(): Promise<Types.LoadHereMapResult> {
    this.phases.resolve(Types.GeoMapPhase.Loading);
    // debugger;

    const load = this.window.load ? this.window.load : loadMapApi;

    const mapResult = await load(this.config, this.window);

    if (mapResult.result.type === Types.ResultType.Success) {
      this.api = mapResult.result.payload;
    }

    this.phases.resolve(Types.GeoMapPhase.Loaded);
    return mapResult;
  }

  public async mount(
    el: HTMLElement,
    mountInit: Types.GeoMapMountInit
  ): Promise<void> {
    this.phases.resolve(Types.GeoMapPhase.Mounting);

    const { api } = this;
    // console.log('mount:', this);

    this.platform = new this.api.service.Platform({
      app_code: this.config.appCode,
      app_id: this.config.appId,
      useHTTPS: true
    });

    this.mapType = mountInit.type || Types.GeoMapType.Roadmap;
    this.layer = mountInit.layer || Types.GeoLayer.None;

    const layer = getHereMapLayer(
      {
        type: this.mapType,
        layer: this.layer,
        language: this.config.language
      },
      {
        platform: this.platform
        // window: this.window
      }
    );

    this.map = new api.Map(el, layer, {
      center: mountInit.center,
      zoom: mountInit.zoom
    });

    this.phases.resolve(Types.GeoMapPhase.Mounted);
    this.phases.resolve(Types.GeoMapPhase.Layouting);

    // tslint:disable-next-line:no-unused-expression
    new api.mapevents.Behavior(new api.mapevents.MapEvents(this.map));

    this.window.window.addEventListener('resize', () =>
      this.map.getViewPort().resize()
    );

    if (this.config.viewport) {
      const {
        viewport: { top, right, bottom, left }
      } = this.config;

      this.map.getViewPort().setPadding(top, right, bottom, left);
    }

    await (this.window.loaded
      ? this.window.loaded(this.map, {
          api: this.api,
          geoMapCtx: this.window
        })
      : hereMapLoaded(this.map, { api: this.api, context: this.window }));

    this.phases.resolve(Types.GeoMapPhase.Layouted);
    return;
  }

  public async phase(phase: Types.GeoMapPhase): Promise<void> {
    return this.phases.get(phase);
  }

  public async getCenter(): Promise<Types.GeoPoint> {
    await this.phase(Types.GeoMapPhase.Mounted);
    return this.map.getCenter();
  }

  public async setCenter(center: Types.GeoPoint): Promise<void> {
    await this.phase(Types.GeoMapPhase.Mounted);
    return this.waitForChangeEvent(async rs => {
      const currentCenter = this.map.getCenter();
      if (pointEqual(center, currentCenter)) {
        return rs();
      }
      this.map.setCenter(center);
    });
  }

  public async getMarkers(): Promise<GeoMarkerHere[]> {
    return this.markers;
  }

  public async getLayer(): Promise<Types.GeoLayer> {
    return this.layer;
  }

  public async setLayer(layer: Types.GeoLayer): Promise<void> {
    this.layer = layer;
    return this.setType(this.mapType);
  }

  public async getType(): Promise<Types.GeoMapType> {
    return this.mapType;
  }

  public async setType(type: Types.GeoMapType): Promise<void> {
    this.mapType = type;
    await this.phase(Types.GeoMapPhase.Mounted);

    return this.waitForChangeEvent(async () => {
      this.map.setBaseLayer(
        getHereMapLayer(
          {
            type: this.mapType,
            layer: this.layer,
            language: this.config.language
          },
          {
            platform: this.platform
            // window: this.window.window
          }
        )
      );
    });
  }

  public async setViewport(viewport: Types.GeoMapViewport): Promise<void> {
    const { top, right, bottom, left } = viewport;
    await this.phase(Types.GeoMapPhase.Mounted);
    return this.waitForChangeEvent(async () => {
      this.map.getViewPort().setPadding(top, right, bottom, left);
    });
  }

  public async getViewBounds(): Promise<Types.GeoBounds> {
    await this.phase(Types.GeoMapPhase.Mounted);
    const bounds = this.map.getViewBounds();
    const rect = GeoRectHere.from(bounds, { mapImplementation: this });
    return rect.getBounds();
  }

  public async setViewBounds(bounds: Types.GeoBounds): Promise<void> {
    await this.phase(Types.GeoMapPhase.Mounted);
    return this.waitForChangeEvent(async rs => {
      const currentVieewBounds = this.map.getViewBounds();
      const rect = GeoRectHere.create(bounds, { mapImplementation: this });
      if (currentVieewBounds.equals(rect.toRect())) {
        return rs();
      }
      this.map.setViewBounds(rect.toRect());
    });
  }

  public async getZoom(): Promise<number> {
    // await this.changed(false);
    await this.phase(Types.GeoMapPhase.Mounted);
    return this.map.getZoom();
  }

  public async setZoom(factor: number): Promise<void> {
    const previousFactor = await this.getZoom();

    return this.waitForChangeEvent(async rs => {
      if (previousFactor === factor) {
        return rs();
      }
      // this.tainted = true;
      this.map.setZoom(factor);
    });
  }

  public async addEventListener(
    eventName: Types.GeoEvent.Click,
    handler: Types.GeoEventHandler<Types.GeoClickPayload>
  ): Promise<void>;
  public async addEventListener(
    eventName: Types.GeoEvent.Changed,
    handler: Types.GeoEventHandler<void>
  ): Promise<void>;
  public async addEventListener(
    eventName: Types.GeoEvent,
    handler: Types.GeoEventHandler
  ): Promise<void> {
    // const previous = this.handlers.get(eventName) || [];
    // this.handlers.set(eventName, [...previous, handler]);

    const hereEventName = geoToHereEvent(eventName);

    if (!hereEventName) {
      return;
    }

    await this.phase(Types.GeoMapPhase.Mounted);

    // console.log('WHAT', hereEventName);
    // tslint:disable-next-line:no-any
    this.map.addEventListener(hereEventName, (e: any) => {
      // console.log('WTF', e);
      if (eventName === Types.GeoEvent.Click) {
        const position = this.map.screenToGeo(
          e.currentPointer.viewportX,
          e.currentPointer.viewportY
        );
        handler({ position });
        return;
      }

      handler();
    });
  }

  public async createMarker(config: Types.GeoMarkerConfig): Promise<GeoMarker> {
    return GeoMarker.create({
      browserCtx: config.browserCtx,
      provider: Types.GeoMapProvider.Here,
      mapImplementation: this,
      position: config.position,
      icon: config.icon
    });
  }

  public async coversLocation(point: Types.GeoPoint): Promise<boolean> {
    const viewBounds = GeoRectHere.create(await this.getViewBounds(), {
      mapImplementation: this
    });
    return viewBounds.coversLocation(point);
  }
}

function hereMapLoaded(
  map: H.Map,
  _: { api: typeof H; context: Types.GeoMapContext }
): Promise<void> {
  return new Promise(resolve => {
    map.addEventListener('mapviewchangeend', () => {
      resolve();
    });
  });
}

function getHereMapLayer(
  config: { language?: string; type: Types.GeoMapType; layer: Types.GeoLayer },
  context: { platform: H.service.Platform }
): H.map.layer.TileLayer {
  const defaultLayers = context.platform.createDefaultLayers({
    tileSize: 256,
    lg: isoToHereLanguage(config.language || 'en'),
    ppi: getOptimalHerePixelDensity(),
    pois: true
  });

  const key = getHereMapKey(config.layer);

  switch (config.type) {
    case Types.GeoMapType.Hybrid:
      return defaultLayers.satellite[key] || defaultLayers.satellite.map;
    case Types.GeoMapType.Roadmap:
    default:
      return defaultLayers.normal[key] || defaultLayers.normal.map;
  }
}

function getHereMapKey(layer: Types.GeoLayer): 'map' | 'traffic' | 'transit' {
  switch (layer) {
    case Types.GeoLayer.Transit:
      return 'transit';
    case Types.GeoLayer.Traffic:
      return 'traffic';
    case Types.GeoLayer.None:
    default:
      return 'map';
  }
}

function isoToHereLanguage(isoCode: string): Types.HereLanguage {
  // tslint:disable-next-line:no-any
  return (Types.HereLanguage[isoCode as any] ||
    Types.HereLanguage.en) as Types.HereLanguage;
}

function getOptimalHerePixelDensity(): number {
  // tslint:disable:no-any
  const keys = Object.keys(Types.HerePixelDensity).filter(
    k => typeof Types.HerePixelDensity[k as any] === 'number'
  );
  const scale = (keys.map(
    k => Types.HerePixelDensity[k as any]
  ) as any[]) as number[];
  const devicePpi = (window.devicePixelRatio || 1) * 72;
  return scale.find(ppi => ppi > devicePpi) || scale[scale.length - 1];
}

function geoToHereEvent(input: Types.GeoEvent): string | undefined {
  switch (input) {
    case Types.GeoEvent.Click:
      return 'tap';
    case Types.GeoEvent.Changed:
      return 'mapviewchangeend';
    default:
      return;
  }
}

function pointEqual(p1: Types.GeoPoint, p2: Types.GeoPoint) {
  // this does not near the poles
  const toleranz = 0.00002;
  const topLeft = { lat: p1.lat - toleranz, lng: p1.lng - toleranz };
  const bottomRight = { lat: p1.lat + toleranz, lng: p1.lng + toleranz };
  return (
    topLeft.lat <= p2.lat &&
    p2.lat <= bottomRight.lat &&
    (topLeft.lng <= p2.lng && p2.lng <= bottomRight.lng)
  );
}
