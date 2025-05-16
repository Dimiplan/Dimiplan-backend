import React, { useEffect, useState } from 'react';
import { ApiClient } from 'adminjs';
import { useLocation } from 'react-router-dom';
import { Box, H2, H4, Text, Table, TableHead, TableBody, TableRow, TableCell, Button, Badge, Icon, Input, Select, Pagination } from '@adminjs/design-system';
import { styled } from '@adminjs/design-system/styled-components';

const Card = styled(Box)`
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 16px;
  margin-bottom: 16px;
`;

const LogTable = styled(Table)`
  margin-top: 20px;
  width: 100%;
  table-layout: fixed;
  
  ${TableCell} {
    padding: 8px 12px;
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

const Toolbar = styled(Box)`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
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

const LogViewer = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [expanded, setExpanded] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [logsPerPage] = useState(50);
  
  const api = new ApiClient();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const fileName = query.get('fileName') || 'combined.log';
  
  useEffect(() => {
    setLoading(true);
    
    api.getPage({
      pageName: 'logs',
      params: {
        fileName,
        limit: 5000 // Higher limit for searching and filtering
      }
    })
      .then((response) => {
        if (response.data.error) {
          setError(response.data.error);
          setLogs([]);
        } else if (response.data.entries) {
          setLogs(response.data.entries);
          setError(null);
        } else {
          setLogs([]);
          setError('Invalid log data format');
        }
      })
      .catch((err) => {
        setError('Failed to load log data');
        console.error(err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [fileName]);
  
  // Parse and prepare log entries
  const parseLogEntry = (entry) => {
    if (typeof entry === 'string') {
      try {
        return JSON.parse(entry);
      } catch (e) {
        return { message: entry };
      }
    }
    return entry;
  };
  
  // Apply filters to logs
  const filteredLogs = logs
    .map(parseLogEntry)
    .filter(log => {
      // Text filter
      const textMatch = filter ? 
        JSON.stringify(log).toLowerCase().includes(filter.toLowerCase()) : 
        true;
      
      // Level filter
      const levelMatch = levelFilter ? 
        (log.level || '').toLowerCase() === levelFilter.toLowerCase() : 
        true;
      
      return textMatch && levelMatch;
    });
  
  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / logsPerPage);
  const indexOfLastLog = currentPage * logsPerPage;
  const indexOfFirstLog = indexOfLastLog - logsPerPage;
  const currentLogs = filteredLogs.slice(indexOfFirstLog, indexOfLastLog);
  
  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  
  // Toggle expanded view for a log entry
  const toggleExpand = (index) => {
    setExpanded(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };
  
  if (loading) {
    return (
      <Box>
        <Text>Loading log data...</Text>
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
        <H2>Log Viewer</H2>
        <Text>Viewing log file: <strong>{fileName}</strong></Text>
      </Box>
      
      <Card>
        <Toolbar>
          <Box flexGrow={1}>
            <Input
              placeholder="Filter logs..."
              value={filter}
              onChange={e => {
                setFilter(e.target.value);
                setCurrentPage(1); // Reset to first page on filter change
              }}
              width="100%"
            />
          </Box>
          
          <Box minWidth={200}>
            <Select
              value={levelFilter}
              onChange={e => {
                setLevelFilter(e.target.value);
                setCurrentPage(1); // Reset to first page on filter change
              }}
              options={[
                { value: '', label: 'All Levels' },
                { value: 'error', label: 'Error' },
                { value: 'warn', label: 'Warning' },
                { value: 'info', label: 'Info' },
                { value: 'verbose', label: 'Verbose' },
                { value: 'debug', label: 'Debug' }
              ]}
            />
          </Box>
          
          <Button
            onClick={() => window.location.reload()}
            size="sm"
          >
            Refresh Logs
          </Button>
        </Toolbar>
        
        <Box mb={16}>
          <Text>{filteredLogs.length} log entries found</Text>
        </Box>
        
        <LogTable>
          <TableHead>
            <TableRow>
              <TableCell width="10%">Level</TableCell>
              <TableCell width="20%">Timestamp</TableCell>
              <TableCell width="70%">Message</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {currentLogs.length > 0 ? (
              currentLogs.map((log, index) => {
                const actualIndex = indexOfFirstLog + index;
                const isExpanded = expanded[actualIndex];
                
                return (
                  <React.Fragment key={actualIndex}>
                    <TableRow onClick={() => toggleExpand(actualIndex)} style={{ cursor: 'pointer' }}>
                      <TableCell>
                        <LogLevel level={log.level} />
                      </TableCell>
                      <TableCell>
                        <TimeStamp>{log.timestamp || '—'}</TimeStamp>
                      </TableCell>
                      <TableCell>
                        <Text>{log.message || JSON.stringify(log).substring(0, 100) + '...'}</Text>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={3} style={{ backgroundColor: '#f5f5f5', whiteSpace: 'pre-wrap' }}>
                          <Box p={10}>
                            <Text as="pre" style={{ fontSize: '12px', maxHeight: '300px', overflow: 'auto' }}>
                              {JSON.stringify(log, null, 2)}
                            </Text>
                          </Box>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={3} style={{ textAlign: 'center' }}>
                  <Text>No log entries found matching your filters</Text>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </LogTable>
        
        {totalPages > 1 && (
          <Box mt={16} display="flex" justifyContent="center">
            <Pagination
              page={currentPage}
              perPage={logsPerPage}
              total={filteredLogs.length}
              onChange={paginate}
            />
          </Box>
        )}
      </Card>
    </Box>
  );
};

export default LogViewer;