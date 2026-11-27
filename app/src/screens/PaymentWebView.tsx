import React from 'react';
import { Linking, Modal, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Button } from '../ui';

// Hosted checkout (Razorpay/Stripe) shown inside the app on iOS and Android.
export default function PaymentWebView({ url, onPaid, onClose }: { url: string | null; onPaid: () => void; onClose: () => void }) {
  return (
    <Modal visible={!!url} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, paddingTop: 44, backgroundColor: '#fff' }}>
        <Button title="Close" variant="outline" onPress={onClose} style={{ marginHorizontal: 12, marginBottom: 8 }} />
        {url ? (
          <WebView
            source={{ uri: url }}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={['*']}
            startInLoadingState
            onShouldStartLoadWithRequest={(req) => {
              // UPI apps and other deep links must open outside the WebView.
              if (!/^https?:/i.test(req.url) && req.url !== 'about:blank') {
                Linking.openURL(req.url).catch(() => {});
                return false;
              }
              return true;
            }}
            onNavigationStateChange={(s) => {
              if (s.url.includes('/pay/result')) {
                if (s.url.includes('status=success')) onPaid();
                else onClose();
              }
            }}
          />
        ) : null}
      </View>
    </Modal>
  );
}
