import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_flutter/webview_flutter.dart';

void main() {
  runApp(const BadmintonApp());
}

class BadmintonApp extends StatelessWidget {
  const BadmintonApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Badminton Mabar',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primarySwatch: Colors.indigo,
        useMaterial3: true,
      ),
      home: const WebViewScreen(),
    );
  }
}

class WebViewScreen extends StatefulWidget {
  const WebViewScreen({super.key});

  @override
  State<WebViewScreen> createState() => _WebViewScreenState();
}

class _WebViewScreenState extends State<WebViewScreen> {
  static const _homeUrl = 'http://192.168.18.122:3002';
  late final WebViewController _controller;
  double _progress = 0;
  bool _isLoading = true;
  String _currentUrl = _homeUrl;

  @override
  void initState() {
    super.initState();
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onUrlChange: (change) {
            _currentUrl = change.url ?? _currentUrl;
          },
          onPageStarted: (url) {
            setState(() {
              _isLoading = true;
              _progress = 0;
            });
          },
          onProgress: (progress) {
            setState(() {
              _progress = progress / 100;
            });
          },
          onPageFinished: (url) {
            setState(() {
              _isLoading = false;
            });
          },
          onWebResourceError: (error) {
            debugPrint('WebView error: ${error.description}');
          },
        ),
      )
      ..loadRequest(Uri.parse(_homeUrl));
  }

  bool get _isOnLoginPage {
    final path = Uri.tryParse(_currentUrl)?.path ?? '';
    return path.endsWith('/login') || path.endsWith('/auth/login');
  }

  Future<void> _handleBack() async {
    if (_isOnLoginPage) {
      SystemNavigator.pop();
      return;
    }
    if (await _controller.canGoBack()) {
      await _controller.goBack();
    } else {
      SystemNavigator.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, result) {
          if (!didPop) _handleBack();
        },
        child: SafeArea(
          child: Stack(
            children: [
              WebViewWidget(controller: _controller),
              if (_isLoading)
                Container(
                  color: Colors.white,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Image(
                        image: AssetImage('assets/icon.png'),
                        width: 120,
                        height: 120,
                      ),
                      const SizedBox(height: 24),
                      const Text(
                        'Badminton Mabar',
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: Colors.indigo,
                        ),
                      ),
                      const SizedBox(height: 32),
                      SizedBox(
                        width: 200,
                        child: LinearProgressIndicator(
                          value: _progress,
                          backgroundColor: Colors.indigo.shade100,
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.indigo),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}