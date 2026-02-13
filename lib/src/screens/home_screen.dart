/// 主界面 - Web 适配版
/// 移除 dart:io，使用 Web 原生 API 和 file_picker
library;

import 'dart:async';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:universal_html/html.dart' as html;
import '../../widgets/progress_card.dart';
import '../../widgets/responsive_layout.dart';
import '../models/ncm_file.dart';
import '../services/ncm_decoder.dart';
import 'settings_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final List<NcmFile> _files = [];
  bool _isProcessing = false;
  int _completed = 0;
  int _failed = 0;
  String? _currentFile;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('NCM Converter PWA'),
        backgroundColor: theme.colorScheme.inversePrimary,
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            tooltip: '设置',
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (context) => const SettingsScreen()),
              );
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: ResponsiveLayout(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 文件选择区域
              _buildFileSelector(theme),

              const SizedBox(height: 16),

              // 文件列表
              Expanded(child: _buildFileList()),

              // 进度显示
              if (_isProcessing || _files.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: ProgressCard(
                    total: _files.length,
                    completed: _completed,
                    failed: _failed,
                    currentFile: _currentFile,
                    isProcessing: _isProcessing,
                  ),
                ),

              const SizedBox(height: 16),

              // 底部按钮栏
              Row(
                children: [
                  if (_files.isNotEmpty)
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(right: 8.0),
                        child: OutlinedButton.icon(
                          onPressed: _isProcessing ? null : _clearList,
                          icon: const Icon(Icons.delete_outline),
                          label: const Text('清空列表'),
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 16),
                          ),
                        ),
                      ),
                    ),
                  Expanded(
                    flex: 2,
                    child: FilledButton.icon(
                      onPressed: _canStart ? _startDecoding : null,
                      icon: Icon(
                        _isProcessing
                            ? Icons.hourglass_empty
                            : Icons.play_arrow,
                      ),
                      label: Text(
                        _isProcessing ? '正在处理...' : '开始转换 (${_files.length})',
                      ),
                      style: FilledButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFileSelector(ThemeData theme) {
    return Card(
      color: theme.colorScheme.primaryContainer,
      child: InkWell(
        onTap: _isProcessing ? null : _pickFiles,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            children: [
              Icon(
                Icons.cloud_upload_outlined,
                size: 48,
                color: theme.colorScheme.onPrimaryContainer,
              ),
              const SizedBox(height: 12),
              Text(
                '点击选择 NCM 文件',
                style: theme.textTheme.titleMedium?.copyWith(
                  color: theme.colorScheme.onPrimaryContainer,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Text(
                '支持多选',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onPrimaryContainer.withOpacity(0.7),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFileList() {
    if (_files.isEmpty) {
      return Center(
        child: Text(
          '暂无文件',
          style: TextStyle(color: Theme.of(context).colorScheme.outline),
        ),
      );
    }

    return Card(
      child: ListView.separated(
        itemCount: _files.length,
        separatorBuilder: (context, index) => const Divider(height: 1),
        itemBuilder: (context, index) => _buildFileListItem(_files[index]),
      ),
    );
  }

  Widget _buildFileListItem(NcmFile file) {
    return ListTile(
      leading: _buildStatusIcon(file),
      title: Text(file.name, maxLines: 1, overflow: TextOverflow.ellipsis),
      subtitle: file.errorMessage != null
          ? Text(file.errorMessage!, style: const TextStyle(color: Colors.red))
          : (file.status == NcmFileStatus.success && file.outputName != null
                ? Text('已转换: ${file.outputName}')
                : null),
      trailing: file.status == NcmFileStatus.success
          ? IconButton(
              icon: const Icon(Icons.download),
              onPressed: () => _downloadFile(file),
              tooltip: '下载文件',
            )
          : null,
    );
  }

  Widget _buildStatusIcon(NcmFile file) {
    if (file.status == NcmFileStatus.processing) {
      return const SizedBox(
        width: 24,
        height: 24,
        child: CircularProgressIndicator(strokeWidth: 2),
      );
    }
    switch (file.status) {
      case NcmFileStatus.pending:
        return const Icon(Icons.music_note, color: Colors.grey);
      case NcmFileStatus.success:
        return const Icon(Icons.check_circle, color: Colors.green);
      case NcmFileStatus.failed:
        return const Icon(Icons.error, color: Colors.red);
      default:
        return const Icon(Icons.help);
    }
  }

  bool get _canStart =>
      !_isProcessing &&
      _files.isNotEmpty &&
      _files.any((f) => f.status != NcmFileStatus.success);

  void _clearList() {
    setState(() {
      _files.clear();
      _completed = 0;
      _failed = 0;
    });
  }

  Future<void> _pickFiles() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['ncm'],
        allowMultiple: true,
        withData: true, // Web 必需，获取 bytes
      );

      if (result != null) {
        setState(() {
          final newFiles = result.files
              .map((f) => NcmFile(name: f.name, bytes: f.bytes!))
              .toList();

          // 简单的去重添加
          for (var newFile in newFiles) {
            if (!_files.any(
              (existing) =>
                  existing.name == newFile.name &&
                  existing.bytes.lengthInBytes == newFile.bytes.lengthInBytes,
            )) {
              _files.add(newFile);
            }
          }
        });
      }
    } catch (e) {
      _showSnackBar('选择文件失败: $e');
    }
  }

  Future<void> _startDecoding() async {
    setState(() {
      _isProcessing = true;
      _completed = 0;
      _failed = 0;
    });

    final decoder = NcmDecoder.instance;

    for (var i = 0; i < _files.length; i++) {
      final file = _files[i];
      if (file.status == NcmFileStatus.success) continue;

      setState(() {
        file.status = NcmFileStatus.processing;
        _currentFile = file.name;
      });

      final result = await decoder.decodeBytes(file.bytes, file.name);

      setState(() {
        if (result.success) {
          file.status = NcmFileStatus.success;
          file.outputBytes = result.data;
          file.outputName = result.outputName;
          _completed++;

          // 自动触发下载？为了用户体验，也许只在全部完成后提示，或者提供下载按钮。
          // 浏览器可能会阻止连续的自动下载弹窗。
          // 这里我们只更新状态，用户可以手动点击下载，或者我们在转换完成后提供“下载全部”功能（打包zip）。
        } else {
          file.status = NcmFileStatus.failed;
          file.errorMessage = result.errorMessage;
          _failed++;
        }
      });
    }

    setState(() {
      _isProcessing = false;
      _currentFile = null;
    });

    _showCompletionDialog();
  }

  void _downloadFile(NcmFile file) {
    if (file.outputBytes == null || file.outputName == null) return;

    final blob = html.Blob([file.outputBytes]);
    final url = html.Url.createObjectUrlFromBlob(blob);
    html.AnchorElement(href: url)
      ..setAttribute('download', file.outputName!)
      ..click();
    html.Url.revokeObjectUrl(url);
  }

  void _showCompletionDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('转换完成'),
        content: Text('成功: $_completed, 失败: $_failed'),
        actions: [
          FilledButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('确定'),
          ),
        ],
      ),
    );
  }

  void _showSnackBar(String message) {
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }
}
