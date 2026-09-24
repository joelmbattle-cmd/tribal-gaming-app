import { getBankOptions, getFloorMapData, getMapChangeLog } from "@/lib/data/floor";
import { FloorMapView } from "@/components/views/floor-map-view";

export default async function FloorPage() {
  const [mapData, changeLog, bankOptions] = await Promise.all([getFloorMapData(), getMapChangeLog(), getBankOptions()]);

  return (
    <FloorMapView
      areas={mapData.areas}
      banks={mapData.banks}
      plans={mapData.plans}
      bankOptions={bankOptions}
      mapWidth={mapData.mapWidth}
      mapHeight={mapData.mapHeight}
      changeLog={changeLog.map((c) => ({
        id: c.id,
        changeType: c.changeType,
        bankName: c.bankName,
        areaLabel: c.areaLabel,
        notes: c.notes,
        ts: c.ts.toISOString().slice(0, 10),
      }))}
    />
  );
}
