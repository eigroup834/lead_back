import { useState } from 'react';
import {
  IconButton, Badge, Popover, List, ListItemButton, ListItemText, Typography, Box, Divider, Button,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useListNotificationsQuery, useMarkReadMutation } from '@/features/adminApi';

export default function NotificationsBell() {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const { data } = useListNotificationsQuery(undefined, { pollingInterval: 30000 });
  const [markRead] = useMarkReadMutation();
  const items = data?.data ?? [];
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <>
      <IconButton onClick={(e) => setAnchor(e.currentTarget)}>
        <Badge badgeContent={unread} color="error"><NotificationsIcon /></Badge>
      </IconButton>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ width: 340 }}>
          <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Notifications</Typography>
            {unread > 0 && <Button size="small" onClick={() => items.filter((n) => !n.readAt).forEach((n) => markRead(n.id))}>Mark all read</Button>}
          </Box>
          <Divider />
          <List dense sx={{ maxHeight: 380, overflow: 'auto' }}>
            {items.map((n) => (
              <ListItemButton key={n.id} onClick={() => !n.readAt && markRead(n.id)} sx={{ bgcolor: n.readAt ? 'transparent' : 'action.hover' }}>
                <ListItemText
                  primary={n.title}
                  secondary={<>{n.body}<br /><Typography component="span" variant="caption" color="text.secondary">{new Date(n.createdAt).toLocaleString()}</Typography></>}
                />
              </ListItemButton>
            ))}
            {items.length === 0 && (
              <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}><Typography variant="body2">No notifications</Typography></Box>
            )}
          </List>
        </Box>
      </Popover>
    </>
  );
}
