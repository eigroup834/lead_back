import { Box, Card, CardContent, Typography } from '@mui/material';
import ConstructionIcon from '@mui/icons-material/Construction';

export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>{title}</Typography>
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 8 }}>
          <ConstructionIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">
            The <b>{title}</b> module is scaffolded and wired to the API layer. UI coming in the next phase.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
