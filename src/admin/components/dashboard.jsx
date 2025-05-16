import React, { useEffect, useState } from 'react';
import { ApiClient } from 'adminjs';
import { Box, H2, H4, Text, Table, TableHead, TableBody, TableRow, TableCell, Button, Badge, Icon } from '@adminjs/design-system';
import { styled } from '@adminjs/design-system/styled-components';

const Card = styled(Box)`
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 16px;
  margin-bottom: 16px;
  transition: all 0.3s;
  
  &:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }
`;

const Grid = styled(Box)`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
`;

const LogTable = styled(Table)`
  margin-top: 20px;
  width: 100%;
  
  ${TableCell} {
    padding: 8px 12px;
    font-size: 12px;
  }
`;

const TimeStamp = styled(Text)`
  color: #666;
  font-size: 12px;
`;

const StatusBadge = styled(Badge)`
  padding: 4px 8px;
  margin-right: 8px;
`;

const LogLevel = ({ level }) => {
  const levelColors = {
    error: 'error',
    warn: 'warning',
    info: 'success',
    verbose: 'info',
    debug: 'info',
    silly: 'light'
  };
  
  return <StatusBadge outline bg={levelColors[level] || 'light'}>{level || 'info'}</StatusBadge>;
};

const Dashboard = () => {
  const [data, setData] = useState({ stats: {}, logFiles: [], recentLogs: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const api = new ApiClient();
  
  useEffect(() => {
    setLoading(true);
    api.getDashboard()
      .then((response) => {
        setData(response.data);
        setError(null);
      })
      .catch((err) => {
        setError('Failed to load dashboard data');
        console.error(err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);
  
  if (loading) {
    return (
      <Box>
        <Text>Loading dashboard data...</Text>
      </Box>
    );
  }
  
  if (error) {
    return (
      <Box>
        <Text color="error">{error}</Text>
      </Box>
    );
  }
  
  return (
    <Box>
      <Box mb={24}>
        <H2>Dimiplan Admin Dashboard</H2>
        <Text>Welcome to the administration panel for Dimiplan application.</Text>
      </Box>
      
      <Box mb={24}>
        <H4>System Statistics</H4>
        <Grid>
          <Card>
            <Text textAlign="center" fontWeight="bold" fontSize={32}>{data.stats.users || 0}</Text>
            <Text textAlign="center">Total Users</Text>
          </Card>
          <Card>
            <Text textAlign="center" fontWeight="bold" fontSize={32}>{data.stats.planners || 0}</Text>
            <Text textAlign="center">Planners</Text>
          </Card>
          <Card>
            <Text textAlign="center" fontWeight="bold" fontSize={32}>{data.stats.tasks || 0}</Text>
            <Text textAlign="center">Tasks</Text>
          </Card>
          <Card>
            <Text textAlign="center" fontWeight="bold" fontSize={32}>{data.stats.chatRooms || 0}</Text>
            <Text textAlign="center">Chat Rooms</Text>
          </Card>
        </Grid>
      </Box>
      
      <Box mb={24}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <H4>Recent System Logs</H4>
          <Button as="a" href="#/pages/logs" size="sm">View All Logs</Button>
        </Box>
        
        <Card>
          <LogTable>
            <TableHead>
              <TableRow>
                <TableCell>Level</TableCell>
                <TableCell>Timestamp</TableCell>
                <TableCell>Message</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.recentLogs && data.recentLogs.length > 0 ? (
                data.recentLogs.map((log, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <LogLevel level={log.level} />
                    </TableCell>
                    <TableCell>
                      <TimeStamp>{log.timestamp || new Date().toISOString()}</TimeStamp>
                    </TableCell>
                    <TableCell>
                      <Text>{log.message || JSON.stringify(log)}</Text>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} style={{ textAlign: 'center' }}>
                    <Text>No recent logs found</Text>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </LogTable>
        </Card>
      </Box>
      
      <Box mb={24}>
        <H4>Log Files</H4>
        <Card>
          <LogTable>
            <TableHead>
              <TableRow>
                <TableCell>Filename</TableCell>
                <TableCell>Size</TableCell>
                <TableCell>Last Modified</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.logFiles && data.logFiles.length > 0 ? (
                data.logFiles.map((file, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Text>{file.name}</Text>
                    </TableCell>
                    <TableCell>
                      <Text>{file.size}</Text>
                    </TableCell>
                    <TableCell>
                      <TimeStamp>{new Date(file.modified).toLocaleString()}</TimeStamp>
                    </TableCell>
                    <TableCell>
                      <Button 
                        as="a" 
                        href={`#/pages/logs?fileName=${file.name}`} 
                        size="sm" 
                        ml="default" 
                        variant="text"
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} style={{ textAlign: 'center' }}>
                    <Text>No log files found</Text>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </LogTable>
        </Card>
      </Box>
    </Box>
  );
};

export default Dashboard;