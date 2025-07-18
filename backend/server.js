const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();

// Enhanced CORS configuration - MUST be before other middleware
app.use(cors({
    origin: ['http://127.0.0.1:5500', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Handle preflight requests
app.options('*', cors());

// Other middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB connection (unchanged)
const mongoURI = 'mongodb+srv://01fe22bcs259:Sagar@cluster0.v0jo1.mongodb.net/hrm_system';
mongoose.connect(mongoURI, { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Models (unchanged)
const LoginSchema = new mongoose.Schema({
    employeeId: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const EmployeeSchema = new mongoose.Schema({
    employeeId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    mobile: { type: String, required: true },
    role: { type: String, required: true, enum: ['HR', 'Team Lead', 'Developer'] },
    teamId: { type: String },
    teamName: { type: String }
});

// const EmployeeSchema = new mongoose.Schema({
//     employeeId: { type: String, required: true, unique: true },
//     name: { type: String, required: true },
//     email: { type: String, required: true, unique: true },
//     mobile: { type: String, required: true },
//     role: { type: String, required: true, enum: ['HR', 'Team Lead', 'Developer'] }
// });

const Login = mongoose.model('Login', LoginSchema);
const Employee = mongoose.model('Employee', EmployeeSchema);

// JWT Secret
const JWT_SECRET = 'your_jwt_secret_key_here';


// Update Employee Schema to include teamId and teamName

// 7. Update Employee (including role change)
app.put('/api/employees/:employeeId', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
        jwt.verify(token, JWT_SECRET);
        
        const { employeeId } = req.params;
        const updateData = req.body;

        // Handle role change
        if (updateData.role) {
            const currentEmployee = await Employee.findOne({ employeeId });
            
            // If changing from Team Lead, remove their team
            if (currentEmployee.role === 'Team Lead' && updateData.role !== 'Team Lead') {
                await Team.deleteOne({ leadId: employeeId });
                // Update team references for team members
                await Employee.updateMany(
                    { teamId: currentEmployee.teamId },
                    { $unset: { teamId: "", teamName: "" } }
                );
            }
            
            // If changing to Team Lead, create new team
            if (updateData.role === 'Team Lead' && currentEmployee.role !== 'Team Lead') {
                const newTeam = new Team({
                    name: `Team ${employeeId}`,
                    leadId: employeeId,
                    leadName: currentEmployee.name,
                    memberIds: []
                });
                await newTeam.save();
                updateData.teamId = newTeam._id;
                updateData.teamName = newTeam.name;
            }
        }

        const updatedEmployee = await Employee.findOneAndUpdate(
            { employeeId },
            updateData,
            { new: true }
        );

        if (!updatedEmployee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        // Also update login credentials if needed
        if (updateData.password) {
            await Login.findOneAndUpdate(
                { employeeId },
                { password: updateData.password }
            );
        }

        res.json(updatedEmployee);
    } catch (error) {
        console.error('Error updating employee:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// 8. Delete Employee
app.delete('/api/employees/:employeeId', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
        jwt.verify(token, JWT_SECRET);
        
        const { employeeId } = req.params;
        const employee = await Employee.findOne({ employeeId });

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        // Handle team lead deletion
        if (employee.role === 'Team Lead') {
            await Team.deleteOne({ leadId: employeeId });
            // Remove team references from members
            await Employee.updateMany(
                { teamId: employee.teamId },
                { $unset: { teamId: "", teamName: "" } }
            );
        } else if (employee.teamId) {
            // Remove from team member list if developer
            await Team.updateOne(
                { _id: employee.teamId },
                { $pull: { memberIds: employeeId } }
            );
        }

        // Delete from both collections
        await Employee.deleteOne({ employeeId });
        await Login.deleteOne({ employeeId });

        res.json({ success: true, message: 'Employee deleted successfully' });
    } catch (error) {
        console.error('Error deleting employee:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// 9. Get single employee details
app.get('/api/employees/:employeeId', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
        jwt.verify(token, JWT_SECRET);
        
        const { employeeId } = req.params;
        const employee = await Employee.findOne({ employeeId });

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        res.json(employee);
    } catch (error) {
        console.error('Error getting employee:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
// Static file routes (unchanged)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/hr_login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'hr_login.html'));
});

app.get('/teamLead_login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'teamLead_login.html'));
});

app.get('/developer_login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'developer_login.html'));
});

app.get('/hr_dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'hr_dashboard.html'));
});

app.get('/teamlead_dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'teamlead_dashboard.html'));
});

app.get('/developer_dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'developer_dashboard.html'));
});

// API Endpoints with CORS headers
app.post('/api/login', async (req, res) => {
    // Set CORS headers
    res.header('Access-Control-Allow-Origin', req.headers.origin || 'http://127.0.0.1:5500');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    const { employeeId, password, role } = req.body;

    try {
        const user = await Login.findOne({ employeeId });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        if (user.password !== password) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const employee = await Employee.findOne({ employeeId });
        if (!employee) {
            return res.status(401).json({ message: 'Employee not found' });
        }

        if (employee.role !== role) {
            return res.status(403).json({ message: 'Access denied for this role' });
        }

        const token = jwt.sign(
            { employeeId: user.employeeId, role: employee.role },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({ 
            token,
            employeeId: user.employeeId,
            role: employee.role,
            name: employee.name
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Other API endpoints (validate-token and employee) remain the same as previous version
app.post('/api/validate-token', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    const { employeeId } = req.body;

    if (!token) {
        return res.status(401).json({ valid: false });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        if (decoded.employeeId !== employeeId) {
            return res.status(401).json({ valid: false });
        }

        res.json({ valid: true });
    } catch (error) {
        res.status(401).json({ valid: false });
    }
});

app.post('/api/employee', async (req, res) => {
    const { employeeId } = req.body;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        // Verify token
        jwt.verify(token, JWT_SECRET);
        
        // Find employee details
        const employee = await Employee.findOne({ employeeId });
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        res.json({
            name: employee.name,
            email: employee.email,
            mobile: employee.mobile,
            role: employee.role
        });
    } catch (error) {
        console.error('Employee data error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Add Team Schema
const TeamSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    leadId: { type: String, required: true, unique: true },
    leadName: { type: String, required: true },
    memberIds: { type: [String], default: [] }
});

const Team = mongoose.model('Team', TeamSchema);

// New API Endpoints for HR Dashboard

// 1. Check if employee ID exists
app.post('/api/check-employee-id', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    const { employeeId } = req.body;

    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        jwt.verify(token, JWT_SECRET);
        
        const employee = await Employee.findOne({ employeeId });
        res.json({ exists: !!employee });
    } catch (error) {
        console.error('Error checking employee ID:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// 2. Add new employee
app.post('/api/add-employee', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
        jwt.verify(token, JWT_SECRET);
        
        const { employeeId, name, email, mobile, role, password, teamName, teamId } = req.body;
        
        // Create login credentials
        const newLogin = new Login({ employeeId, password });
        await newLogin.save();
        
        // Create employee record
        const newEmployee = new Employee({ employeeId, name, email, mobile, role });
        await newEmployee.save();
        
        // Handle team assignment based on role
        if (role === 'Team Lead' && teamName) {
            const newTeam = new Team({
                name: teamName,
                leadId: employeeId,
                leadName: name,
                memberIds: req.body.memberIds || []
            });
            await newTeam.save();
            
            // Update assigned members
            if (req.body.memberIds && req.body.memberIds.length > 0) {
                await Employee.updateMany(
                    { employeeId: { $in: req.body.memberIds } },
                    { $set: { teamId: newTeam._id, teamName } }
                );
            }
        } else if (role === 'Developer' && teamId) {
            const team = await Team.findById(teamId);
            if (team) {
                await Employee.updateOne(
                    { employeeId },
                    { $set: { teamId, teamName: team.name } }
                );
                await Team.updateOne(
                    { _id: teamId },
                    { $push: { memberIds: employeeId } }
                );
            }
        }
        
        res.json({ success: true, message: 'Employee added successfully' });
    } catch (error) {
        console.error('Error adding employee:', error);
        res.status(500).json({ message: error.message || 'Failed to add employee' });
    }
});

// 3. Get statistics
app.get('/api/statistics', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
        jwt.verify(token, JWT_SECRET);
        
        const totalEmployees = await Employee.countDocuments();
        const totalTeamLeads = await Employee.countDocuments({ role: 'Team Lead' });
        const totalDevelopers = await Employee.countDocuments({ role: 'Developer' });
        const totalTeams = await Team.countDocuments();
        
        res.json({ totalEmployees, totalTeamLeads, totalDevelopers, totalTeams });
    } catch (error) {
        console.error('Error getting statistics:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// 4. Get all employees
app.get('/api/employees', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
        jwt.verify(token, JWT_SECRET);
        
        const employees = await Employee.find({}, '-_id employeeId name email mobile role teamName');
        res.json(employees);
    } catch (error) {
        console.error('Error getting employees:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// 5. Get available members for team assignment
app.get('/api/available-members', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
        jwt.verify(token, JWT_SECRET);
        
        // Get developers not assigned to any team
        const members = await Employee.find(
            { role: 'Developer', teamId: { $exists: false } },
            'employeeId name role'
        );
        res.json(members);
    } catch (error) {
        console.error('Error getting available members:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// 6. Get all teams
app.get('/api/teams', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
        jwt.verify(token, JWT_SECRET);
        
        const teams = await Team.find({}, 'name leadName');
        res.json(teams);
    } catch (error) {
        console.error('Error getting teams:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
// Add these schemas before the API endpoints
const AvailabilitySchema = new mongoose.Schema({
    employeeId: { 
        type: String, 
        required: true,
        index: true 
    },
    weekStartDate: { 
        type: Date, 
        required: true,
        index: true 
    },
    availability: {
        type: {
            monday: [{
                start: String,
                end: String
            }],
            tuesday: [{
                start: String,
                end: String
            }],
            wednesday: [{
                start: String,
                end: String
            }],
            thursday: [{
                start: String,
                end: String
            }]
        },
        required: true
    },
    repeatWeekly: { 
        type: Boolean, 
        default: false 
    }
}, { timestamps: true });
const TimeTrackingSchema = new mongoose.Schema({
    employeeId: { 
        type: String, 
        required: true,
        index: true 
    },
    action: { 
        type: String, 
        enum: ['clock-in', 'clock-out'], 
        required: true 
    },
    timestamp: { 
        type: Date, 
        default: Date.now,
        index: true 
    },
    duration: { 
        type: Number,
        min: 0
    }
}, { timestamps: true });



const FeedbackSchema = new mongoose.Schema({
    employeeId: { type: String, required: true },
    sender: { type: String, required: true }, // 'Team Lead', 'HR', or 'AI Assistant'
    senderId: { type: String, required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

const PerformanceSchema = new mongoose.Schema({
    employeeId: { type: String, required: true, unique: true },
    hoursCompleted: { type: Number, default: 0 },
    onTimeAvailability: { type: Number, default: 100 }, // percentage
    activityVariance: { type: Number, default: 0 }, // percentage
    productivityScore: { type: Number, default: 95 },
    lastUpdated: { type: Date, default: Date.now }
});

const Availability = mongoose.model('Availability', AvailabilitySchema);
const TimeTracking = mongoose.model('TimeTracking', TimeTrackingSchema);
const Feedback = mongoose.model('Feedback', FeedbackSchema);
const Performance = mongoose.model('Performance', PerformanceSchema);

// Add these API endpoints after your existing endpoints

// 1. Availability APIs
// Submit Availability
app.post('/api/submit-availability', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const { employeeId, availability } = req.body;

        if (decoded.employeeId !== employeeId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        // Validate input
        if (!availability || typeof availability !== 'object') {
            return res.status(400).json({ message: 'Invalid availability data' });
        }

        // Calculate week start date (Monday)
        const today = new Date();
        const weekStartDate = new Date(today.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)));
        weekStartDate.setHours(0, 0, 0, 0);

        // Use upsert to create or update
        const result = await Availability.findOneAndUpdate(
            { 
                employeeId,
                weekStartDate: { 
                    $gte: new Date(weekStartDate),
                    $lt: new Date(new Date(weekStartDate).setDate(weekStartDate.getDate() + 7))
                }
            },
            {
                availability,
                repeatWeekly: availability.repeatWeekly || false,
                weekStartDate
            },
            { 
                upsert: true,
                new: true,
                setDefaultsOnInsert: true 
            }
        );

        console.log('Availability saved:', result);
        res.json({ 
            success: true, 
            message: 'Availability submitted successfully',
            availability: result.availability 
        });

    } catch (error) {
        console.error('Error submitting availability:', error);
        res.status(500).json({ 
            message: 'Server error',
            error: error.message 
        });
    }
});

// Get Availability
app.post('/api/get-availability', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const { employeeId } = req.body;

        if (decoded.employeeId !== employeeId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        // Calculate current week's start date (Monday)
        const today = new Date();
        const weekStartDate = new Date(today.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)));
        weekStartDate.setHours(0, 0, 0, 0);

        // Find availability for current week
        const availability = await Availability.findOne({
            employeeId,
            weekStartDate: { 
                $gte: weekStartDate,
                $lt: new Date(new Date(weekStartDate).setDate(weekStartDate.getDate() + 7))
            }
        });

        if (!availability) {
            return res.json({ 
                availability: null,
                message: 'No availability submitted for this week' 
            });
        }

        res.json({ 
            availability: availability.availability,
            repeatWeekly: availability.repeatWeekly
        });

    } catch (error) {
        console.error('Error getting availability:', error);
        res.status(500).json({ 
            message: 'Server error',
            error: error.message 
        });
    }
});

// 2. Time Tracking APIs
app.post('/api/clock-in', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const { employeeId } = req.body;

        if (!employeeId || decoded.employeeId !== employeeId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        // Check for existing clock-in without clock-out
        const activeSession = await TimeTracking.findOne({
            employeeId,
            action: 'clock-in',
            duration: { $exists: false }
        });

        if (activeSession) {
            return res.status(400).json({ 
                message: 'You are already clocked in',
                lastClockIn: activeSession.timestamp
            });
        }

        // Create new clock-in entry
        const clockIn = new TimeTracking({
            employeeId,
            action: 'clock-in'
        });
        
        await clockIn.save();

        res.json({ 
            success: true, 
            timestamp: clockIn.timestamp,
            message: 'Clocked in successfully'
        });

    } catch (error) {
        console.error('Clock in error:', error);
        res.status(500).json({ 
            message: 'Server error',
            error: error.message 
        });
    }
});

// Clock Out Endpoint
app.post('/api/clock-out', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const { employeeId } = req.body;

        if (!employeeId || decoded.employeeId !== employeeId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        // Find last clock-in without duration
        const lastClockIn = await TimeTracking.findOne({
            employeeId,
            action: 'clock-in',
            duration: { $exists: false }
        }).sort({ timestamp: -1 });

        if (!lastClockIn) {
            return res.status(400).json({ 
                message: 'No active clock-in found',
                suggestion: 'Please clock in first'
            });
        }

        // Calculate duration in hours
        const now = new Date();
        const duration = (now - lastClockIn.timestamp) / (1000 * 60 * 60); // Convert ms to hours
        const roundedDuration = parseFloat(duration.toFixed(2));

        // Update clock-in with duration
        lastClockIn.duration = roundedDuration;
        await lastClockIn.save();

        // Create clock-out entry
        const clockOut = new TimeTracking({
            employeeId,
            action: 'clock-out'
        });
        await clockOut.save();

        res.json({ 
            success: true, 
            duration: roundedDuration,
            message: 'Clocked out successfully'
        });

    } catch (error) {
        console.error('Clock out error:', error);
        res.status(500).json({ 
            message: 'Server error',
            error: error.message 
        });
    }
});

app.post('/api/current-clock-status', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const { employeeId } = req.body;

        if (!employeeId || decoded.employeeId !== employeeId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        // Get today's records
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const records = await TimeTracking.find({
            employeeId,
            timestamp: { $gte: today }
        }).sort({ timestamp: 1 });

        // Check current status
        let status = 'clocked-out';
        let lastClockIn = null;
        const todayActivities = [];

        records.forEach(record => {
            todayActivities.push({
                time: record.timestamp,
                action: record.action,
                duration: record.duration
            });

            if (record.action === 'clock-in' && !record.duration) {
                status = 'clocked-in';
                lastClockIn = record.timestamp;
            }
        });

        res.json({
            status,
            lastClockIn,
            todayActivities
        });

    } catch (error) {
        console.error('Error getting clock status:', error);
        res.status(500).json({ 
            message: 'Server error',
            error: error.message 
        });
    }
});

app.post('/api/time-tracking-status', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const { employeeId } = req.body;

        if (!employeeId || decoded.employeeId !== employeeId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        // Get today's records (from midnight to now)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const records = await TimeTracking.find({
            employeeId,
            timestamp: { $gte: today }
        }).sort({ timestamp: 1 });

        // Determine current status
        let status = 'clocked-out';
        let lastClockIn = null;
        const activities = [];

        records.forEach(record => {
            activities.push({
                time: record.timestamp,
                action: record.action,
                duration: record.duration
            });

            if (record.action === 'clock-in' && !record.duration) {
                status = 'clocked-in';
                lastClockIn = record.timestamp;
            }
        });

        res.json({
            status,
            lastClockIn,
            activities
        });

    } catch (error) {
        console.error('Error getting time tracking status:', error);
        res.status(500).json({ 
            message: 'Server error',
            error: error.message 
        });
    }
});

// 3. Performance APIs
app.post('/api/get-performance', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const { employeeId } = req.body;

        if (decoded.employeeId !== employeeId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const performance = await Performance.findOne({ employeeId });
        if (!performance) {
            // Create default performance record if not exists
            const newPerformance = new Performance({ employeeId });
            await newPerformance.save();
            return res.json(newPerformance);
        }

        res.json(performance);
    } catch (error) {
        console.error('Error getting performance:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// 4. Feedback APIs
app.post('/api/get-feedback', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const { employeeId } = req.body;

        if (decoded.employeeId !== employeeId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const feedbacks = await Feedback.find({ employeeId }).sort({ timestamp: -1 }).limit(10);

        // Add AI-generated feedback if none exists
        if (feedbacks.length === 0) {
            const aiFeedback = new Feedback({
                employeeId,
                sender: 'AI Assistant',
                senderId: 'ai-system',
                message: 'Welcome to your dashboard! Submit your weekly availability to get started.'
            });
            await aiFeedback.save();
            feedbacks.push(aiFeedback);
        }

        res.json({ feedbacks });
    } catch (error) {
        console.error('Error getting feedback:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/request-feedback', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const { employeeId, recipient, message } = req.body;

        if (decoded.employeeId !== employeeId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        // Get employee details
        const employee = await Employee.findOne({ employeeId });
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        // Determine recipient ID based on role
        let recipientId, recipientName;
        if (recipient === 'teamLead') {
            if (!employee.teamId) {
                return res.status(400).json({ message: 'You are not assigned to a team' });
            }
            
            const team = await Team.findOne({ _id: employee.teamId });
            if (!team) {
                return res.status(400).json({ message: 'Team not found' });
            }
            
            recipientId = team.leadId;
            const lead = await Employee.findOne({ employeeId: team.leadId });
            recipientName = lead ? lead.name : 'Team Lead';
        } else {
            // HR
            const hr = await Employee.findOne({ role: 'HR' });
            if (!hr) {
                return res.status(400).json({ message: 'HR manager not found' });
            }
            
            recipientId = hr.employeeId;
            recipientName = hr.name;
        }

        // Create feedback request
        const feedbackRequest = new Feedback({
            employeeId,
            sender: employee.name,
            senderId: employeeId,
            message: `Feedback request: ${message}`
        });
        await feedbackRequest.save();

        res.json({ success: true, message: 'Feedback request sent successfully' });
    } catch (error) {
        console.error('Error requesting feedback:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Helper function to update performance metrics
async function updatePerformanceMetrics(employeeId, hoursWorked) {
    // Get or create performance record
    let performance = await Performance.findOne({ employeeId });
    if (!performance) {
        performance = new Performance({ employeeId });
    }

    // Update hours completed
    performance.hoursCompleted = (performance.hoursCompleted || 0) + hoursWorked;
    
    // Simple algorithm to update other metrics (can be enhanced)
    if (performance.hoursCompleted >= 36) {
        performance.onTimeAvailability = 100;
        performance.activityVariance = 0;
        performance.productivityScore = 100;
    } else {
        const progress = performance.hoursCompleted / 36;
        performance.onTimeAvailability = Math.min(100, Math.round(progress * 100));
        performance.activityVariance = Math.round((1 - progress) * 100);
        performance.productivityScore = Math.max(70, Math.round(progress * 100));
    }

    performance.lastUpdated = new Date();
    await performance.save();
}

// Add this to the end of your file, before app.listen
console.log('All APIs loaded successfully');
// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`CORS configured for: http://127.0.0.1:5500 and http://localhost:3000`);
});