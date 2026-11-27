import React from 'react';
import { View } from 'react-native';
import { MapPoint, osmEmbedUrl } from './map';

export default function LiveMap({ marker, other, height = 220 }: { marker: MapPoint; other?: MapPoint; height?: number }) {
  return (
    <View style={{ height, borderRadius: 12, overflow: 'hidden' }}>
      {React.createElement('iframe', { src: osmEmbedUrl(marker, other), style: { border: 0, width: '100%', height: '100%' }, title: 'Live location' })}
    </View>
  );
}
