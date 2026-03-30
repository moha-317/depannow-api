const NotificationModel = require('../models/notification.model');

/**
 * GET /api/notifications
 * Récupérer toutes les notifications de l'utilisateur connecté
 */
const getNotifications = async (req, res) => {
  try {
    const notifications = await NotificationModel.findByUserId(req.user.id);
    const unreadCount = await NotificationModel.countUnread(req.user.id);

    return res.status(200).json({
      success: true,
      data: {
        notifications,
        unread_count: unreadCount,
        total: notifications.length,
      },
    });
  } catch (error) {
    console.error('Erreur getNotifications :', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des notifications.',
    });
  }
};

/**
 * PUT /api/notifications/:id/read
 * Marquer une notification comme lue
 */
const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que la notification appartient à l'utilisateur
    const notification = await NotificationModel.findByIdAndUserId(id, req.user.id);
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification introuvable.',
      });
    }

    // Si déjà lue, retourner directement
    if (notification.is_read) {
      return res.status(200).json({
        success: true,
        message: 'Notification déjà marquée comme lue.',
        data: { notification },
      });
    }

    // Marquer comme lue
    const updatedNotification = await NotificationModel.markAsRead(id, req.user.id);

    return res.status(200).json({
      success: true,
      message: 'Notification marquée comme lue.',
      data: { notification: updatedNotification },
    });
  } catch (error) {
    console.error('Erreur markNotificationAsRead :', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la mise à jour de la notification.',
    });
  }
};

module.exports = { getNotifications, markNotificationAsRead };
