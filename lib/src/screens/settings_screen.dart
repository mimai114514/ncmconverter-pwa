import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../widgets/responsive_layout.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('设置'),
        backgroundColor: theme.colorScheme.inversePrimary,
      ),
      body: ResponsiveLayout(
        child: ListView(
          children: [
            // 关于部分
            const _SectionHeader(title: '关于'),
            ListTile(
              leading: const Icon(Icons.info_outline),
              title: const Text('关于本应用'),
              subtitle: const Text('查看版本信息和版权声明'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => _showAboutDialog(context),
            ),
          ],
        ),
      ),
    );
  }

  void _showAboutDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 16),
            // 应用图标
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Image.asset(
                'assets/icon-ncmconverter-v1.png',
                width: 80,
                height: 80,
              ),
            ),
            const SizedBox(height: 16),
            // 应用名
            const Text(
              'NCM Converter',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            // 应用包名
            Text(
              'io.github.mimai114514.ncmconverter',
              style: TextStyle(
                fontSize: 14,
                color: Theme.of(context).colorScheme.outline,
              ),
            ),
            const SizedBox(height: 8),
            // 版本信息
            Text(
              'v1.0.0',
              style: TextStyle(
                fontSize: 14,
                color: Theme.of(context).colorScheme.outline,
              ),
            ),
            const SizedBox(height: 16),
            //开发者信息
            Text('Developed by Infinity.', style: TextStyle(fontSize: 16)),
            const SizedBox(height: 12),
            // Github 链接
            InkWell(
              onTap: () async {
                final url = Uri.parse(
                  'https://github.com/mimai114514/ncmconverter',
                );
                if (await canLaunchUrl(url)) {
                  await launchUrl(url, mode: LaunchMode.externalApplication);
                }
              },
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 4,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.code,
                      size: 20,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '在 GitHub 上查看',
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.primary,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('完成'),
          ),
        ],
      ),
    );
  }
}

/// 设置页面的分区标题组件
class _SectionHeader extends StatelessWidget {
  final String title;

  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.bold,
          color: Theme.of(context).colorScheme.primary,
        ),
      ),
    );
  }
}
