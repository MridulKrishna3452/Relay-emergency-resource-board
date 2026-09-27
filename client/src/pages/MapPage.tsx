import { Link } from 'react-router-dom';
import { Circle, CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { List } from 'lucide-react';
import { FilterBar } from '../components/FilterBar';
import { ErrorState } from '../components/States';
import { PRIORITY_META, STATUS_META } from '../lib/constants';
import { formatDistance, timeAgo } from '../lib/format';
import { buildListParams, useBoardFilters, useLiveRequests, useNearOrigin } from '../lib/useBoard';
import { LiveIndicator } from './Board';

const CHENNAI: [number, number] = [12.97, 80.2];

export default function MapPage() {
  const { filters, update } = useBoardFilters();
  const near = useNearOrigin(filters, update);
  const origin = near.origin?.coords ?? null;
  const params = buildListParams(filters, origin, 1, 100);
  const query = useLiveRequests(params, !(filters.near && !origin));
  const items = (query.data?.items ?? []).filter((r) => r.lat != null && r.lng != null);
  const center: [number, number] = origin ? [origin.lat, origin.lng] : CHENNAI;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Map view</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span>{query.data ? `${items.length} request${items.length === 1 ? '' : 's'} on the map` : 'Loading…'}</span>
            {query.data && <LiveIndicator updatedAt={query.dataUpdatedAt} fetching={query.isFetching} stale={query.isError} />}
          </div>
        </div>
        <Link to={`/board${window.location.search}`} className="btn-secondary">
          <List className="h-4 w-4" aria-hidden /> List view
        </Link>
      </div>

      <FilterBar filters={filters} onChange={update} locating={near.locating} nearLabel={near.label} />

      {query.isError && !query.data ? (
        <div className="mt-4"><ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} /></div>
      ) : (
        <div className="card mt-4 h-[60vh] min-h-[360px] overflow-hidden p-0">
          <MapContainer key={center.join(',')} center={center} zoom={origin ? 13 : 11} scrollWheelZoom className="h-full w-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {origin && (
              <>
                <Circle center={[origin.lat, origin.lng]} radius={filters.radius * 1000} pathOptions={{ color: '#1f786d', weight: 1, fillOpacity: 0.06 }} />
                <CircleMarker center={[origin.lat, origin.lng]} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: '#2563eb', fillOpacity: 1 }}>
                  <Popup>You are here</Popup>
                </CircleMarker>
              </>
            )}
            {items.map((r) => (
              <CircleMarker
                key={r.id}
                center={[r.lat!, r.lng!]}
                radius={r.priority === 'CRITICAL' ? 11 : 8}
                pathOptions={{ color: '#fff', weight: 2, fillColor: PRIORITY_META[r.priority].chart, fillOpacity: 0.95 }}
              >
                <Popup>
                  <div className="space-y-1">
                    <div className="text-xs font-bold uppercase" style={{ color: PRIORITY_META[r.priority].chart }}>
                      {PRIORITY_META[r.priority].label} · {STATUS_META[r.status].label}
                    </div>
                    <div className="font-semibold">{r.title}</div>
                    <div className="text-xs text-slate-600">
                      {r.area} · {timeAgo(r.createdAt)} {formatDistance(r.distanceKm) && `· ${formatDistance(r.distanceKm)}`}
                    </div>
                    <Link to={`/requests/${r.id}`} className="font-semibold text-brand-700">View details →</Link>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      )}
      <ul className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600" aria-label="Legend">
        {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
          <li key={p} className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${PRIORITY_META[p].dot}`} aria-hidden /> {PRIORITY_META[p].label}
          </li>
        ))}
        <li className="text-xs text-slate-500">Pins are approximate (~100 m) until a volunteer accepts.</li>
      </ul>
    </div>
  );
}
