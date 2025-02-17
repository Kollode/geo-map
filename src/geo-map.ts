import { GeoMapGoogle } from './geo-map-google';
import { GeoMapHere } from './geo-map-here';
import { GeoMarker } from './geo-marker';
import { GeoCircle } from './geo-circle';
import { GeoRect } from './geo-rect';
import * as Types from './types';
import { ServerSideGeoMap } from './server-side-geo-map';
import { GeoMapCodingService } from './geo-map-coding-service';
import { GeoMapPlacesService } from './geo-map-places-service';
import { GeoMapDirectionService } from './geo-map-direction-service';
import { DOMContext, BrowserCtx } from './types';

export class GeoMap {
  public readonly init: Types.GeoMapInit;

  public readonly provider: Types.GeoMapProvider;

  /**
   * @internal
   */
  private directionService: GeoMapDirectionService;

  public static create(init: {
    config: Types.GeoMapConfig;
    geoMapCtx?: Types.GeoMapContext;
  }): GeoMap {
    if (typeof window === 'undefined') {
      return new GeoMap({
        browserCtx: init.config.browserCtx,
        implementation: new ServerSideGeoMap(init.config),
        provider: Types.GeoMapProvider.Custom
      });
    }
    if (init.config.provider === Types.GeoMapProvider.Here) {
      return new GeoMap({
        browserCtx: init.config.browserCtx,
        implementation: new GeoMapHere({
          config: init.config as Types.LoadHereMapConfig
        }),
        provider: init.config.provider
      });
    }

    return new GeoMap({
      browserCtx: init.config.browserCtx,
      implementation: new GeoMapGoogle({
        config: init.config as Types.LoadGoogleMapConfig,
        geoMapCtx: init.geoMapCtx
      }),
      provider: init.config.provider
    });
  }

  public static from(
    implementation: BrowserCtx<Types.GeoMapImplementation>
  ): GeoMap {
    return new GeoMap({
      browserCtx: implementation.browserCtx,
      implementation,
      provider: Types.GeoMapProvider.Custom
    });
  }

  private constructor(init: Types.GeoMapInit) {
    this.init = init;
    this.provider = init.provider; // api compatible
  }

  public async createMarker(config: Types.GeoMarkerConfig): Promise<GeoMarker> {
    return GeoMarker.create({
      browserCtx: this.init.browserCtx,
      anchor: config.anchor,
      provider: this.init.provider,
      mapImplementation: this.init.implementation,
      position: config.position,
      icon: config.icon
    });
  }

  public async createGeoRect(config: Types.GeoBounds): Promise<GeoRect> {
    return GeoRect.create(
      { provider: this.init.provider, ...config },
      { mapImplementation: this.init.implementation }
    );
  }

  public async createGeoCircle(
    config: Types.GeoCircleConfig
  ): Promise<GeoCircle> {
    return GeoCircle.create(
      { provider: this.init.provider, ...config },
      { mapImplementation: this.init.implementation }
    );
  }

  public async load(): Promise<Types.LoadMapResult> {
    return this.init.implementation.load();
  }

  public async mount(
    el: HTMLElement,
    init: Types.GeoMapMountInit
  ): Promise<void> {
    await this.init.implementation.load();
    await this.init.implementation.mount(el, init);
  }

  public async phase(phase: Types.GeoMapPhase): Promise<void> {
    return this.init.implementation.phase(phase);
  }

  public getCenter(): Promise<Types.GeoPoint> {
    return this.init.implementation.getCenter();
  }

  public setCenter(center: Types.GeoPoint): Promise<void> {
    return this.init.implementation.setCenter(center);
  }

  public getLayer(): Promise<Types.GeoLayer> {
    return this.init.implementation.getLayer();
  }

  public setLayer(type: Types.GeoLayer): Promise<void> {
    return this.init.implementation.setLayer(type);
  }

  public getType(): Promise<Types.GeoMapType> {
    return this.init.implementation.getType();
  }

  public setType(type: Types.GeoMapType): Promise<void> {
    return this.init.implementation.setType(type);
  }

  public setViewport(viewport: Types.GeoMapViewport): Promise<void> {
    return this.init.implementation.setViewport(viewport);
  }

  public getViewBounds(): Promise<Types.GeoBounds> {
    return this.init.implementation.getViewBounds();
  }

  public setViewBounds(bounds: Types.GeoBounds): Promise<void> {
    return this.init.implementation.setViewBounds(bounds);
  }

  public getZoom(): Promise<number> {
    return this.init.implementation.getZoom();
  }

  public setZoom(zoomFactor: number): Promise<void> {
    return this.init.implementation.setZoom(zoomFactor);
  }

  public async addEventListener(
    eventName: Types.GeoEvent.Click,
    handler: Types.GeoEventHandler<Types.GeoClickPayload>
  ): Promise<void>;
  public async addEventListener(
    eventName: Types.GeoEvent.Changed | Types.GeoEvent.Loaded,
    handler: Types.GeoEventHandler<void>
  ): Promise<void>;
  public async addEventListener(
    event: Types.GeoEvent,
    handler: Types.GeoEventHandler
  ): Promise<void> {
    return this.init.implementation.addEventListener(event, handler);
  }

  // public async coversLocation(point: Types.GeoPoint): Promise<boolean> {
  //   return this.implementation.coversLocation(point);
  // }

  public async reverseGeocode(
    point: Types.GeoPoint
  ): Promise<Types.Result<Types.GeoMapPlaceDetails[]>> {
    await this.phase(Types.GeoMapPhase.Loaded);

    // TODO: Move out of here when splitting GeoMap into Geo -> Map, Geo -> Code, Geo -> ...
    if (this.init.provider === Types.GeoMapProvider.Here) {
      const hereService = GeoMapCodingService.create({
        type: this.init.provider as Types.GeoMapProvider.Here,
        api: (this.init.implementation as GeoMapHere).api,
        platform: (this.init.implementation as GeoMapHere).platform
      });

      return hereService.reverse(point);
    }

    const googleService = GeoMapCodingService.create({
      type: this.init.provider as Types.GeoMapProvider.Google,
      api: (this.init.implementation as GeoMapGoogle).api
    });

    return googleService.reverse(point);
  }

  private async getPlacesService(): Promise<GeoMapPlacesService> {
    await this.phase(Types.GeoMapPhase.Loaded);

    if (this.init.provider === Types.GeoMapProvider.Here) {
      const hereService = GeoMapPlacesService.create({
        browserCtx: this.init.browserCtx,
        type: this.init.provider as Types.GeoMapProvider.Here,
        api: (this.init.implementation as GeoMapHere).api,
        platform: (this.init.implementation as GeoMapHere).platform
      });

      return hereService;
    }

    const googleService = GeoMapPlacesService.create({
      browserCtx: this.init.browserCtx,
      type: this.init.provider as Types.GeoMapProvider.Google,
      api: (this.init.implementation as GeoMapGoogle).api
    });

    return googleService;
  }

  private async getDirectionService(): Promise<GeoMapDirectionService> {
    if (this.directionService) {
      return this.directionService;
    }

    await this.phase(Types.GeoMapPhase.Loaded);

    if (this.init.provider === Types.GeoMapProvider.Here) {
      this.directionService = GeoMapDirectionService.create({
        type: this.init.provider as Types.GeoMapProvider.Here,
        api: (this.init.implementation as GeoMapHere).api,
        platform: (this.init.implementation as GeoMapHere).platform,
        map: this.init.implementation
      });

      return this.directionService;
    }

    this.directionService = GeoMapDirectionService.create({
      type: this.init.provider as Types.GeoMapProvider.Google,
      api: (this.init.implementation as GeoMapGoogle).api,
      map: this.init.implementation
    });

    return this.directionService;
  }

  public async getPlace(
    id: string
  ): Promise<Types.Result<Types.GeoMapPlaceDetails>> {
    const service = await this.getPlacesService();
    return service.get(id);
  }

  /**
   * @param needle Phrase to search for
   * @param center Center of the search operation
   * @param radius Radius around `center` to search in. Defaults to 50000m as the whole earth radius.
   */
  public async search(
    needle: string,
    center: Types.GeoPoint,
    radius = 50000
  ): Promise<Types.Result<Types.GeoMapPlace[]>> {
    const service = await this.getPlacesService();
    return service.search(needle, center, radius);
  }

  /**
   * @param from
   * @param to
   * @param radius
   */
  public async distanceBetween(
    from: Types.GeoPoint,
    to: Types.GeoPoint,
    radius?: number
  ): Promise<number> {
    const service = await this.getPlacesService();
    return service.distanceBetween(from, to, radius);
  }

  public async paintRoute(
    from: Types.GeoPoint,
    to: Types.GeoPoint
  ): Promise<Types.GeoMapDirectionResult> {
    const service = await this.getDirectionService();
    return service.paintRoute(from, to);
  }

  public async clearDrawings(): Promise<void> {
    const service = await this.getDirectionService();
    service.clear();
  }
}
