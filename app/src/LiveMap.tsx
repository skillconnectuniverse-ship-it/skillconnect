import React from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { MapPoint, osmEmbedUrl } from './map';

export default function LiveMap({ marker, other, height = 220 }: { marker: MapPoint; other?: MapPoint; height?: number }) {
  return (
    <View style={{ height, borderRadius: 12, overflow: 'hidden' }}>
      <WebView source={{ uri: osmEmbedUrl(marker, other) }} style={{ flex: 1 }} scrollEnabled={false} />
    </View>
  );
}
