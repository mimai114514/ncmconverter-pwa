import 'package:flutter/material.dart';

class ResponsiveLayout extends StatelessWidget {
  final Widget child;

  const ResponsiveLayout({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth > 800) {
          // Desktop: Center and limit width to 50%
          return Center(
            child: SizedBox(width: constraints.maxWidth * 0.5, child: child),
          );
        } else {
          // Mobile: Full width
          return child;
        }
      },
    );
  }
}
