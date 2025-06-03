require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3200;

// Middleware
app.use(cors());
app.use(express.json());

// Simple in-memory cache
const cache = {
  professors: { data: null, timestamp: 0 },
  itcourses: { data: null, timestamp: 0 },
  file_link: { data: null, timestamp: 0 },
  events: { data: null, timestamp: 0 }
};

// Cache validity duration (5 minutes)
const CACHE_TTL = 300000;

// Initialize Supabase client with environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Supabase proxy server is running',
    supabaseConnected: !!supabaseUrl && !!supabaseKey
  });
});

// Debug endpoint to list all tables
app.get('/api/debug/tables', async (req, res) => {
  try {
    console.log('Fetching available tables from Supabase');
    
    // Query for listing tables in PostgreSQL
    const { data, error } = await supabase
      .rpc('list_tables');
    
    if (error) {
      console.error('Error fetching tables:', error);
      throw error;
    }
    
    console.log('Tables data:', data);
    res.json(data || []);
  } catch (error) {
    console.error('Error in /api/debug/tables:', error);
    
    // Try alternative method if RPC fails
    try {
      console.log('Trying alternative method to list tables');
      const { data, error } = await supabase
        .from('pg_tables')
        .select('tablename')
        .eq('schemaname', 'public');
        
      if (error) throw error;
      console.log('Tables found via pg_tables:', data);
      res.json(data || []);
    } catch (alt_error) {
      console.error('Alternative method also failed:', alt_error);
      res.status(500).json({ 
        error: error.message,
        alternative_error: alt_error.message 
      });
    }
  }
});

// Authentication endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      logError(error, '/api/auth/login');
      return res.status(401).json({ error: error.message });
    }
    
    return res.status(200).json({ session: data.session });
  } catch (error) {
    logError(error, '/api/auth/login');
    return res.status(500).json({ error: 'Server error. Please try again later.' });
  }
});

app.get('/api/auth/session', async (req, res) => {
  try {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      logError(error, '/api/auth/session');
      return res.status(400).json({ error: error.message });
    }
    
    return res.status(200).json({ session: data.session });
  } catch (error) {
    logError(error, '/api/auth/session');
    return res.status(500).json({ error: 'Server error. Please try again later.' });
  }
});

// Logout endpoint
app.post('/api/auth/logout', async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      logError(error, '/api/auth/logout');
      return res.status(400).json({ error: error.message });
    }
    
    return res.status(200).json({ success: true });
  } catch (error) {
    logError(error, '/api/auth/logout');
    return res.status(500).json({ error: 'Server error. Please try again later.' });
  }
});

// Helper function for logging errors
function logError(error, endpoint) {
  console.error(`Error in ${endpoint}:`, error);
  console.error('Error details:', JSON.stringify(error, null, 2));
}

// Get from cache or fetch from Supabase
async function getCachedOrFetch(table, supabaseTable) {
  const now = Date.now();
  
  // Return cached data if still valid
  if (cache[table].data && (now - cache[table].timestamp < CACHE_TTL)) {
    return cache[table].data;
  }
  
  // Fetch fresh data from Supabase
  const { data, error } = await supabase
    .from(supabaseTable)
    .select('*')
    .order('id', { ascending: true });
  
  if (error) throw error;
  
  // Update cache
  cache[table] = {
    data,
    timestamp: now
  };
  
  return data;
}

// Clear cache for a specific table
function clearCache(table) {
  if (cache[table]) {
    cache[table] = { data: null, timestamp: 0 };
  }
}

// Proxy endpoints for professors table
app.get('/api/professors', async (req, res) => {
  try {
    const data = await getCachedOrFetch('professors', 'Professors');
    res.json(data);
  } catch (error) {
    logError(error, '/api/professors');
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/professors', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('Professors')
      .insert(req.body);
    
    if (error) throw error;
    
    clearCache('professors');
    res.json(data);
  } catch (error) {
    logError(error, '/api/professors');
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/professors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('Professors')
      .update(req.body)
      .eq('id', id);
    
    if (error) throw error;
    
    clearCache('professors');
    res.json(data);
  } catch (error) {
    logError(error, '/api/professors/:id');
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/professors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('Professors')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    clearCache('professors');
    res.json(data);
  } catch (error) {
    logError(error, '/api/professors/:id');
    res.status(500).json({ error: error.message });
  }
});

// Similar endpoints for itcourses
app.get('/api/itcourses', async (req, res) => {
  try {
    const data = await getCachedOrFetch('itcourses', 'ITCourses');
    res.json(data);
  } catch (error) {
    logError(error, '/api/itcourses');
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/itcourses', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ITCourses')
      .insert(req.body);
    
    if (error) throw error;
    
    clearCache('itcourses');
    res.json(data);
  } catch (error) {
    logError(error, '/api/itcourses');
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/itcourses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('ITCourses')
      .update(req.body)
      .eq('id', id);
    
    if (error) throw error;
    
    clearCache('itcourses');
    res.json(data);
  } catch (error) {
    logError(error, '/api/itcourses/:id');
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/itcourses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('ITCourses')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    clearCache('itcourses');
    res.json(data);
  } catch (error) {
    logError(error, '/api/itcourses/:id');
    res.status(500).json({ error: error.message });
  }
});

// Similar endpoints for file_link
app.get('/api/file_link', async (req, res) => {
  try {
    const data = await getCachedOrFetch('file_link', 'File_link');
    res.json(data);
  } catch (error) {
    logError(error, '/api/file_link');
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/file_link', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('File_link')
      .insert(req.body);
    
    if (error) throw error;
    
    clearCache('file_link');
    res.json(data);
  } catch (error) {
    logError(error, '/api/file_link');
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/file_link/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('File_link')
      .update(req.body)
      .eq('id', id);
    
    if (error) throw error;
    
    clearCache('file_link');
    res.json(data);
  } catch (error) {
    logError(error, '/api/file_link/:id');
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/file_link/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('File_link')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    clearCache('file_link');
    res.json(data);
  } catch (error) {
    logError(error, '/api/file_link/:id');
    res.status(500).json({ error: error.message });
  }
});

// Add endpoints for bulk operations
app.delete('/api/professors/:ids', async (req, res) => {
  try {
    const { ids } = req.params;
    const idArray = ids.split(',').map(id => parseInt(id));
    
    const { data, error } = await supabase
      .from('Professors')
      .delete()
      .in('id', idArray);
    
    if (error) throw error;
    
    clearCache('professors');
    res.json(data);
  } catch (error) {
    logError(error, '/api/professors/:ids (bulk)');
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/itcourses/:ids', async (req, res) => {
  try {
    const { ids } = req.params;
    const idArray = ids.split(',').map(id => parseInt(id));
    
    const { data, error } = await supabase
      .from('ITCourses')
      .delete()
      .in('id', idArray);
    
    if (error) throw error;
    
    clearCache('itcourses');
    res.json(data);
  } catch (error) {
    logError(error, '/api/itcourses/:ids (bulk)');
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/file_link/:ids', async (req, res) => {
  try {
    const { ids } = req.params;
    const idArray = ids.split(',').map(id => parseInt(id));
    
    const { data, error } = await supabase
      .from('File_link')
      .delete()
      .in('id', idArray);
    
    if (error) throw error;
    
    clearCache('file_link');
    res.json(data);
  } catch (error) {
    logError(error, '/api/file_link/:ids (bulk)');
    res.status(500).json({ error: error.message });
  }
});

// Route for clearing all caches
app.post('/api/clear-cache', (req, res) => {
  try {
    clearCache('professors');
    clearCache('itcourses');
    clearCache('file_link');
    clearCache('events');
    res.json({ success: true, message: 'All caches cleared' });
  } catch (error) {
    logError(error, '/api/clear-cache');
    res.status(500).json({ error: error.message });
  }
});

// Add debug endpoint to test direct Supabase connection
app.get('/api/debug/supabase-connection', async (req, res) => {
  try {
    console.log('Testing Supabase connection...');
    
    // Test if we can connect to Supabase and get the user
    const { data: userData, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error('Supabase auth error:', userError);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to authenticate with Supabase',
        error: userError.message
      });
    }
    
    console.log('Successfully connected to Supabase');
    
    // Try to list all tables to check database access
    const { data: tableList, error: tableError } = await supabase
      .from('pg_tables')
      .select('tablename')
      .eq('schemaname', 'public');
      
    if (tableError) {
      console.error('Error listing tables:', tableError);
      return res.status(500).json({
        success: false,
        message: 'Connected to Supabase but cannot list tables',
        authData: userData,
        error: tableError.message
      });
    }
    
    console.log('Tables found:', tableList);
    
    return res.json({
      success: true,
      message: 'Successfully connected to Supabase',
      tables: tableList || [],
      user: userData
    });
  } catch (error) {
    console.error('Error connecting to Supabase:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Error connecting to Supabase',
      error: error.message
    });
  }
});

// Direct raw SQL endpoint for testing Event table
app.get('/api/direct/events', async (req, res) => {
  try {
    // Use raw SQL to query the Event table directly
    const { data, error } = await supabase.rpc(
      'execute_sql', 
      { query_text: 'SELECT * FROM "Event" ORDER BY id' }
    );
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    // Update cache
    cache.events = {
      data,
      timestamp: Date.now()
    };
    
    return res.json(data || []);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Fixed events endpoint that uses direct table name
app.get('/api/events', async (req, res) => {
  try {
    // Try to get from cache first
    const now = Date.now();
    if (cache.events.data && (now - cache.events.timestamp < CACHE_TTL)) {
      return res.json(cache.events.data);
    }
    
    // Direct query with proper quoting around the table name
    let data, error;
    
    // Try with quoted table name
    const result = await supabase
      .from('"Event"')
      .select('*');
    
    if (result.error) {
      // Try with unquoted table name
      const fallbackResult = await supabase
        .from('Event')
        .select('*');
      
      if (fallbackResult.error) {
        // Try with lowercase table name
        const lowercaseResult = await supabase
          .from('event')
          .select('*');
        
        if (lowercaseResult.error) {
          return res.status(500).json({ 
            error: 'All attempts to fetch events failed',
            details: 'Could not query any event table variant' 
          });
        }
        
        data = lowercaseResult.data;
      } else {
        data = fallbackResult.data;
      }
    } else {
      data = result.data;
    }
    
    // Update cache
    cache.events = {
      data,
      timestamp: now
    };
    
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ 
      error: 'Server error',
      details: error.message 
    });
  }
});

// Fixed insert endpoint for events
app.post('/api/events', async (req, res) => {
  try {
    // Make a copy of the request body to modify
    const eventData = { ...req.body };
    
    // No need to convert dates since they'll be stored as text
    
    // Validate the input data for events
    const requiredFields = ['Name', 'Start_date', 'Location'];
    const missingFields = requiredFields.filter(field => !eventData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: `Missing required fields: ${missingFields.join(', ')}`,
        details: 'Name, Start_date, and Location are required' 
      });
    }
    
    // Try direct quoted table name
    let { data, error } = await supabase
      .from('"Event"')
      .insert(eventData)
      .select();
    
    if (error) {
      // Try unquoted table name as fallback
      const fallbackResult = await supabase
        .from('Event')
        .insert(eventData)
        .select();
      
      if (fallbackResult.error) {
        // Try lowercase table name as a final fallback
        const lowercaseResult = await supabase
          .from('event')
          .insert(eventData)
          .select();
          
        if (lowercaseResult.error) {
          return res.status(500).json({ 
            error: 'Failed to insert event',
            details: error.message
          });
        }
        
        data = lowercaseResult.data;
      } else {
        data = fallbackResult.data;
      }
    }
    
    // Clear the cache
    clearCache('events');
    
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ 
      error: 'Server error', 
      details: error.message 
    });
  }
});

// Fixed update endpoint for events
app.put('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Make a copy of the request body to modify
    const eventData = { ...req.body };
    
    // No need to convert dates since they'll be stored as text
    
    // Validate the input data for events
    const requiredFields = ['Name', 'Start_date', 'Location'];
    const missingFields = requiredFields.filter(field => !eventData[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: `Missing required fields: ${missingFields.join(', ')}`,
        details: 'Name, Start_date, and Location are required' 
      });
    }
    
    // Try direct quoted table name
    let { data, error } = await supabase
      .from('"Event"')
      .update(eventData)
      .eq('id', id)
      .select();
    
    if (error) {
      // Try unquoted table name as fallback
      const fallbackResult = await supabase
        .from('Event')
        .update(eventData)
        .eq('id', id)
        .select();
      
      if (fallbackResult.error) {
        return res.status(500).json({ 
          error: 'Failed to update event',
          details: error.message,
          fallbackError: fallbackResult.error.message 
        });
      }
      
      // Fallback succeeded
      data = fallbackResult.data;
    }
    
    // Check if no record was updated
    if (!data || data.length === 0) {
      return res.status(404).json({
        error: 'No record updated',
        details: `No event with ID ${id} was updated. The record may not exist.`
      });
    }
    
    // Clear the cache
    clearCache('events');
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ 
      error: 'Server error',
      details: error.message 
    });
  }
});

// Debug endpoint to check Event table structure
app.get('/api/debug/event-structure', async (req, res) => {
  try {
    // First try to query with exact case matching
    const { data: exactCase, error: exactCaseError } = await supabase
      .from('Event')
      .select('*')
      .limit(1);
    
    if (exactCaseError) {
      // Try lowercase
      const { data: lowerCase, error: lowerCaseError } = await supabase
        .from('event')
        .select('*')
        .limit(1);
      
      if (lowerCaseError) {
        throw new Error(`Neither 'Event' nor 'event' tables worked. Errors: ${exactCaseError.message}, ${lowerCaseError.message}`);
      } else {
        res.json({ 
          status: 'success', 
          tableName: 'event',
          data: lowerCase,
          fields: lowerCase && lowerCase[0] ? Object.keys(lowerCase[0]) : [] 
        });
      }
    } else {
      res.json({ 
        status: 'success',
        tableName: 'Event', 
        data: exactCase,
        fields: exactCase && exactCase[0] ? Object.keys(exactCase[0]) : [] 
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// More comprehensive debug endpoint to check all tables and columns
app.get('/api/debug/database-info', async (req, res) => {
  try {
    // Get table names (standard PostgreSQL)
    const tableQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    // Execute raw query for tables
    const { data: tables, error: tableError } = await supabase.rpc('get_tables');
    
    if (tableError) {
      // Try alternative method
      const { data: tablesAlt, error: tableErrorAlt } = await supabase
        .from('pg_tables')
        .select('tablename')
        .eq('schemaname', 'public');
    }
    
    // Try to get information about specific tables we're interested in
    const tableNames = ["Event", "event", "events", "Events"];
    const tablesInfo = {};
    
    for (const tableName of tableNames) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
          
        if (error) {
          tablesInfo[tableName] = { exists: false, error: error.message };
        } else {
          tablesInfo[tableName] = { 
            exists: true, 
            rowCount: data ? data.length : 0,
            columns: data && data[0] ? Object.keys(data[0]) : [] 
          };
        }
      } catch (tableError) {
        tablesInfo[tableName] = { exists: false, error: tableError.message };
      }
    }
    
    res.json({
      tables,
      tablesInfo
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generic query endpoint - can be used to query any table and column
app.get('/api/query/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const { select = '*', limit = 100, order_by = 'id', order_direction = 'asc' } = req.query;
    
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order(order_by, { ascending: order_direction === 'asc' })
      .limit(limit);
    
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete endpoint for events (single ID)
app.delete('/api/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Try different table name variants since we don't know which one works
    let deleted = false;
    let error = null;
    
    // Try with quoted table name
    const result = await supabase
      .from('"Event"')
      .delete()
      .eq('id', id);
    
    if (!result.error) {
      deleted = true;
    } else {
      error = result.error;
      
      // Try with unquoted table name
      const fallbackResult = await supabase
        .from('Event')
        .delete()
        .eq('id', id);
      
      if (!fallbackResult.error) {
        deleted = true;
      } else {
        // Try with lowercase table name
        const lowercaseResult = await supabase
          .from('event')
          .delete()
          .eq('id', id);
        
        if (!lowercaseResult.error) {
          deleted = true;
        } else {
          // All attempts failed
          return res.status(500).json({ 
            error: 'Failed to delete event',
            details: 'All table name variants failed'
          });
        }
      }
    }
    
    // Clear the cache
    clearCache('events');
    
    // Return success
    res.status(200).json({ success: true, message: `Event ${id} deleted successfully` });
  } catch (error) {
    res.status(500).json({ 
      error: 'Server error',
      details: error.message 
    });
  }
});

// Delete endpoint for events (bulk delete with comma-separated IDs)
app.delete('/api/events/:ids', async (req, res) => {
  try {
    const { ids } = req.params;
    const idArray = ids.split(',').map(id => parseInt(id));
    
    if (idArray.length === 0 || idArray.some(id => isNaN(id))) {
      return res.status(400).json({
        error: 'Invalid ID format',
        details: 'IDs must be comma-separated integers'
      });
    }
    
    // Try different table name variants
    let deleted = false;
    
    // Try with quoted table name
    const result = await supabase
      .from('"Event"')
      .delete()
      .in('id', idArray);
    
    if (!result.error) {
      deleted = true;
    } else {
      // Try with unquoted table name
      const fallbackResult = await supabase
        .from('Event')
        .delete()
        .in('id', idArray);
      
      if (!fallbackResult.error) {
        deleted = true;
      } else {
        // Try with lowercase table name
        const lowercaseResult = await supabase
          .from('event')
          .delete()
          .in('id', idArray);
        
        if (!lowercaseResult.error) {
          deleted = true;
        } else {
          // All attempts failed
          return res.status(500).json({ 
            error: 'Failed to delete events',
            details: 'All table name variants failed'
          });
        }
      }
    }
    
    // Clear the cache
    clearCache('events');
    
    // Return success
    res.status(200).json({ 
      success: true, 
      message: `${idArray.length} events deleted successfully` 
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Server error',
      details: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 