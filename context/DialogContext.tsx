import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export type DialogType = 'danger' | 'warning' | 'info' | 'confirm' | 'success';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: DialogType;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
}

export interface AlertDialogOptions {
  title: string;
  message: string;
  buttonText?: string;
  type?: DialogType;
  onDismiss?: () => void;
}

export interface ToastOptions {
  message: string;
  title?: string;
  type?: 'success' | 'info' | 'warning' | 'error';
  durationMs?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
}

interface DialogContextType {
  showConfirm: (options: ConfirmDialogOptions) => void;
  showAlert: (options: AlertDialogOptions) => void;
  showSuccess: (title: string, message?: string) => void;
  showError: (title: string, message?: string) => void;
  showToast: (options: string | ToastOptions) => void;
  dismissDialog: () => void;
}

const DialogContext = createContext<DialogContextType | null>(null);

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Modal Dialog State
  const [modalVisible, setModalVisible] = useState(false);
  const [dialogConfig, setDialogConfig] = useState<{
    title: string;
    message: string;
    type: DialogType;
    confirmText?: string;
    cancelText?: string;
    isConfirm: boolean;
    onConfirm?: () => void | Promise<void>;
    onCancel?: () => void;
    onDismiss?: () => void;
  } | null>(null);

  // Toast / Auto-Dismiss Popup State
  const [toast, setToast] = useState<{
    title?: string;
    message: string;
    type: 'success' | 'info' | 'warning' | 'error';
    action?: { label: string; onPress: () => void };
  } | null>(null);

  const toastFadeAnim = useRef(new Animated.Value(0)).current;
  const toastSlideAnim = useRef(new Animated.Value(30)).current;
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-Dismiss Toast Function
  const showToast = useCallback((options: string | ToastOptions) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    const config: ToastOptions = typeof options === 'string' 
      ? { message: options, type: 'success', durationMs: 2800 }
      : { durationMs: 2800, type: 'success', ...options };

    setToast({
      title: config.title,
      message: config.message,
      type: config.type || 'success',
      action: config.action
    });

    if (config.type === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else if (config.type === 'error') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    toastFadeAnim.setValue(0);
    toastSlideAnim.setValue(30);

    Animated.parallel([
      Animated.timing(toastFadeAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(toastSlideAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();

    toastTimeoutRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(toastFadeAnim, {
          toValue: 0,
          duration: 250,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(toastSlideAnim, {
          toValue: 20,
          duration: 250,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setToast(null);
      });
    }, config.durationMs || 2800);
  }, [toastFadeAnim, toastSlideAnim]);

  // Non-blocking success popup (auto-dismisses on its own without user tap required)
  const showSuccess = useCallback((title: string, message?: string) => {
    showToast({
      title,
      message: message || '',
      type: 'success',
      durationMs: 3000
    });
  }, [showToast]);

  // Error alert/toast
  const showError = useCallback((title: string, message?: string) => {
    if (message) {
      // If there is detailed text, show interactive alert dialog so user can read it
      showAlert({
        title,
        message,
        type: 'danger',
        buttonText: 'Dismiss'
      });
    } else {
      showToast({
        title: 'Error',
        message: title,
        type: 'error',
        durationMs: 3500
      });
    }
  }, []);

  // Show Interactive Confirm Dialog
  const showConfirm = useCallback((options: ConfirmDialogOptions) => {
    if (options.type === 'danger') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    setDialogConfig({
      title: options.title,
      message: options.message,
      type: options.type || 'confirm',
      confirmText: options.confirmText || 'Confirm',
      cancelText: options.cancelText || 'Cancel',
      isConfirm: true,
      onConfirm: options.onConfirm,
      onCancel: options.onCancel
    });
    setModalVisible(true);
  }, []);

  // Show Interactive Alert Dialog
  const showAlert = useCallback((options: AlertDialogOptions) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    setDialogConfig({
      title: options.title,
      message: options.message,
      type: options.type || 'info',
      confirmText: options.buttonText || 'OK',
      isConfirm: false,
      onDismiss: options.onDismiss
    });
    setModalVisible(true);
  }, []);

  const dismissDialog = useCallback(() => {
    setModalVisible(false);
    setDialogConfig(null);
  }, []);

  const handleConfirmAction = async () => {
    if (dialogConfig?.onConfirm) {
      await dialogConfig.onConfirm();
    }
    dismissDialog();
  };

  const handleCancelAction = () => {
    if (dialogConfig?.onCancel) {
      dialogConfig.onCancel();
    }
    dismissDialog();
  };

  const handleDismissAction = () => {
    if (dialogConfig?.onDismiss) {
      dialogConfig.onDismiss();
    }
    dismissDialog();
  };

  const getIconName = (type: DialogType): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'danger':
        return 'alert-circle';
      case 'warning':
        return 'warning';
      case 'success':
        return 'checkmark-circle';
      case 'info':
      case 'confirm':
      default:
        return 'information-circle';
    }
  };

  const getIconColor = (type: DialogType): string => {
    switch (type) {
      case 'danger':
        return '#ef4444';
      case 'warning':
        return '#f59e0b';
      case 'success':
        return '#10b981';
      case 'info':
      case 'confirm':
      default:
        return '#3b82f6';
    }
  };

  const getIconBgColor = (type: DialogType): string => {
    switch (type) {
      case 'danger':
        return 'rgba(239, 68, 68, 0.15)';
      case 'warning':
        return 'rgba(245, 158, 11, 0.15)';
      case 'success':
        return 'rgba(16, 185, 129, 0.15)';
      case 'info':
      case 'confirm':
      default:
        return 'rgba(59, 130, 246, 0.15)';
    }
  };

  return (
    <DialogContext.Provider
      value={{
        showConfirm,
        showAlert,
        showSuccess,
        showError,
        showToast,
        dismissDialog,
      }}
    >
      {children}

      {/* 1. Modal Confirmation / Alert Dialog */}
      {dialogConfig && (
        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
          onRequestClose={dismissDialog}
        >
          <View style={styles.backdrop}>
            <View style={[styles.dialogCard, { borderColor: dialogConfig.type === 'danger' ? '#7f1d1d' : '#334155' }]}>
              {/* Icon Header */}
              <View style={[styles.iconCircle, { backgroundColor: getIconBgColor(dialogConfig.type) }]}>
                <Ionicons
                  name={getIconName(dialogConfig.type)}
                  size={30}
                  color={getIconColor(dialogConfig.type)}
                />
              </View>

              {/* Title & Message */}
              <Text style={styles.dialogTitle}>{dialogConfig.title}</Text>
              <Text style={styles.dialogMessage}>{dialogConfig.message}</Text>

              {/* Action Buttons */}
              {dialogConfig.isConfirm ? (
                <View style={styles.buttonRow}>
                  <Pressable
                    style={[styles.btn, styles.cancelBtn]}
                    onPress={handleCancelAction}
                  >
                    <Text style={styles.cancelBtnText}>
                      {dialogConfig.cancelText || 'Cancel'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.btn,
                      styles.confirmBtn,
                      dialogConfig.type === 'danger' ? styles.dangerBtn : styles.primaryBtn,
                    ]}
                    onPress={handleConfirmAction}
                  >
                    <Text style={styles.btnText}>
                      {dialogConfig.confirmText || 'Confirm'}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={[
                    styles.btn,
                    styles.singleBtn,
                    dialogConfig.type === 'danger' ? styles.dangerBtn : styles.primaryBtn,
                  ]}
                  onPress={handleDismissAction}
                >
                  <Text style={styles.btnText}>
                    {dialogConfig.confirmText || 'OK'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </Modal>
      )}

      {/* 2. Auto-Dismissing Toast / Success Popup (Floats at bottom, auto-dismisses on its own) */}
      {toast && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.toastWrapper,
            {
              opacity: toastFadeAnim,
              transform: [{ translateY: toastSlideAnim }],
            },
          ]}
        >
          <View
            style={[
              styles.toastCard,
              toast.type === 'success' && styles.toastSuccess,
              toast.type === 'error' && styles.toastError,
              toast.type === 'warning' && styles.toastWarning,
              toast.type === 'info' && styles.toastInfo,
            ]}
          >
            <View style={styles.toastIconBox}>
              <Ionicons
                name={
                  toast.type === 'success'
                    ? 'checkmark-circle'
                    : toast.type === 'error'
                    ? 'close-circle'
                    : toast.type === 'warning'
                    ? 'warning'
                    : 'information-circle'
                }
                size={22}
                color={
                  toast.type === 'success'
                    ? '#10b981'
                    : toast.type === 'error'
                    ? '#ef4444'
                    : toast.type === 'warning'
                    ? '#f59e0b'
                    : '#3b82f6'
                }
              />
            </View>
            <View style={styles.toastContent}>
              {toast.title ? <Text style={styles.toastTitle}>{toast.title}</Text> : null}
              <Text style={styles.toastMessage}>{toast.message}</Text>
            </View>

            {toast.action && (
              <Pressable style={styles.toastActionBtn} onPress={toast.action.onPress}>
                <Text style={styles.toastActionText}>{toast.action.label}</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      )}
    </DialogContext.Provider>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 22,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 8,
    alignSelf: 'stretch',
  },
  dialogMessage: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    alignSelf: 'stretch',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    alignSelf: 'stretch',
  },
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  singleBtn: {
    width: '100%',
    alignSelf: 'stretch',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#475569',
  },
  confirmBtn: {
    flex: 1,
  },
  cancelBtnText: {
    color: '#f1f5f9',
    fontWeight: 'bold',
    fontSize: 15,
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: '#0284c7',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  dangerBtn: {
    backgroundColor: '#dc2626',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  btnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15,
    textAlign: 'center',
  },

  // Toast Styles
  toastWrapper: {
    position: 'absolute',
    bottom: 34,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 9999,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: '100%',
    maxWidth: 440,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  toastSuccess: {
    borderColor: 'rgba(16, 185, 129, 0.5)',
  },
  toastError: {
    borderColor: 'rgba(239, 68, 68, 0.5)',
  },
  toastWarning: {
    borderColor: 'rgba(245, 158, 11, 0.5)',
  },
  toastInfo: {
    borderColor: 'rgba(2, 132, 199, 0.5)',
  },
  toastIconBox: {
    marginRight: 12,
  },
  toastContent: {
    flex: 1,
  },
  toastTitle: {
    color: '#f8fafc',
    fontWeight: 'bold',
    fontSize: 13,
    marginBottom: 2,
  },
  toastMessage: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
  },
  toastActionBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  toastActionText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
  }
});
