# Commandix

Enterprise Workflow, Task Management & Team Collaboration Platform

Version: 1.0.0

---

# Introduction

Commandix is a modern enterprise-grade workflow and task management platform designed for organizations, departments, managers, and employees.

The platform provides a complete environment for managing tasks, workflows, internal communication, approvals, department structures, file sharing, notifications, activity tracking, and role-based access control.

Commandix is designed to solve common organizational challenges such as:

* Task tracking
* Team collaboration
* Department management
* Approval workflows
* Internal communication
* Employee accountability
* Progress monitoring
* Activity auditing

The platform is built with scalability and security in mind, making it suitable for startups, medium-sized businesses, large organizations, and enterprise environments.

---

# Project Goals

The main goals of Commandix are:

* Centralize all organizational tasks.
* Improve collaboration between departments.
* Create structured workflow cycles.
* Ensure secure access control.
* Enable real-time communication.
* Track all organizational activities.
* Reduce operational inefficiencies.
* Support future SaaS deployment.

---

# Technology Stack

## Backend

* PHP 8.3+
* Laravel 12
* Laravel Sanctum
* RESTful API Architecture
* Laravel Policies
* Laravel Events & Listeners
* Laravel Notifications
* Laravel Broadcasting
* Laravel Reverb
* Laravel Queues
* MySQL

## Frontend

* React.js
* JavaScript
* Bootstrap 5
* React Router
* Axios
* React Context API
* React Query
* React Toastify
* Chart.js
* @hello-pangea/dnd

## Database

* MySQL 8+

## Storage

* Laravel Storage
* Public File Access Layer

---

# System Architecture

Commandix follows a separated architecture:

```text
Frontend (React)

↓

REST API

↓

Laravel Backend

↓

MySQL Database
```

Authentication is handled through API tokens using Laravel Sanctum.

No session-based authentication is used.

---

# Authentication System

Authentication is fully token-based.

Features:

* Login
* Logout
* Register
* Password Reset
* Change Password
* Email Verification
* Personal Access Tokens

Protected APIs require authentication using Sanctum tokens.

Example:

Authorization: Bearer TOKEN

---

# User Types

The platform contains three primary user types.

## Administrator

System-wide authority.

Capabilities:

* Access all departments.
* Access all users.
* Access all managers.
* Access all tasks.
* Access analytics.
* Access activity logs.
* Manage permissions.
* Manage files.
* Manage workflows.

Restrictions:

None.

---

## Department Manager

Department-level authority.

Capabilities:

* View assigned department.
* Create tasks.
* Assign employees.
* Manage workflow stages.
* Communicate with other managers.
* Review completed work.
* Monitor department performance.

Restrictions:

* Cannot access other departments.
* Cannot view other department employees.
* Cannot access system administration.

---

## Employee

Task execution authority.

Capabilities:

* View assigned tasks only.
* View department information.
* Update task status.
* Upload files.
* Ask questions.
* Participate in workflows.

Restrictions:

* Cannot access analytics dashboard.
* Cannot access other departments.
* Cannot view other employees' tasks.

---

# Department Management

Every organization is divided into departments.

Examples:

* Technology
* Marketing
* Human Resources
* Finance
* Sales
* Customer Support

Each department contains:

* One Manager
* Multiple Employees

Important Rules:

* The manager is displayed separately.
* Managers are not included in team member lists.
* Employees only see their own department.
* Managers only manage their own department.

Department Page Includes:

* Department Information
* Department Manager
* Department Members
* Department Statistics
* Active Tasks

---

# Task Management System

The task system is the core module of Commandix.

Managers can create tasks with:

* Title
* Description
* Priority
* Due Date
* Department
* Assignees
* Mentions
* Attachments

Task priorities:

* Low
* Medium
* High
* Critical

Task statuses:

* Pending
* In Progress
* Review
* Completed

---

# Task Visibility Rules

Tasks are visible only to:

* Task Creator
* Assigned Employees
* Assigned Workflow Participants
* Authorized Managers
* System Administrators

No other users may access task details.

---

# Task Details Page

Every task has a dedicated page.

URL Example:

/tasks/{id}

The page includes:

* Task Information
* Attachments
* Workflow Progress
* Activity Timeline
* Comments
* Questions
* Mentions

Users can open attachments directly.

Supported Files:

* Images
* PDF Files
* Word Documents
* Excel Files
* ZIP Archives

---

# Workflow Engine

Commandix includes a complete workflow management engine.

Workflows support sequential execution.

Example:

Task Created

↓

Employee A

↓

Employee B

↓

Employee C

↓

Manager Review

↓

Completed

Rules:

* Only the active workflow participant can work on the task.
* After completion, the next participant is notified automatically.
* Managers receive completion notifications.
* Workflow history is permanently stored.

---

# Task Discussion System

Every task contains a discussion section.

Employees may:

* Ask questions
* Request clarification
* Mention users
* Reply to comments

Managers receive notifications when employees ask questions.

Discussion history remains attached to the task.

---

# Mentions System

Mentions are supported using:

@username

Rules:

* Managers cannot mention themselves.
* Employees cannot mention unauthorized users.
* Mentioned users receive notifications instantly.

---

# Drag and Drop Task Board

Tasks are displayed on a Kanban board.

Columns:

* Pending
* In Progress
* Review
* Completed

Features:

* Drag and Drop
* Status Buttons
* Real-Time Updates

Users may update task status using either method.

---

# File Management System

The platform contains a centralized file management module.

Features:

* Upload Files
* Download Files
* Preview Files
* Search Files
* Filter Files

Supported Filters:

* User
* Task
* Department
* File Type

Administrative Controls:

* Delete Files
* Restore Files
* Audit File History

---

# Notification System

Real-time notifications are delivered using:

* Laravel Reverb
* Broadcasting
* Events
* Listeners

Notification Types:

* Task Assignment
* Workflow Updates
* Task Completion
* Mentions
* Department Assignment
* Manager Messages
* File Uploads
* Questions and Replies

Notifications remain visible until marked as read.

---

# Manager Communication Center

Managers may communicate with other managers.

Features:

* Direct Messages
* Conversation History
* Read Status
* Real-Time Delivery

Rules:

* Managers must select a target manager.
* Broadcast messaging is not allowed.
* Managers cannot send messages to themselves.

---

# Activity Logging System

All system activities are logged.

Examples:

* User Created
* User Updated
* User Deleted
* Department Created
* Task Created
* Task Updated
* Task Completed
* File Uploaded
* Role Assigned

Each log contains:

* User
* Action
* Timestamp
* IP Address
* Browser Information

Features:

* Pagination
* Search
* Filtering

---

# Roles and Permissions

The platform supports dynamic role management.

Examples:

* Administrator
* Manager
* Employee

Permissions Examples:

* create_tasks
* update_tasks
* delete_tasks
* manage_users
* manage_departments
* manage_roles
* view_reports

Permissions are assigned through roles.

---

# Dashboard System

## Administrator Dashboard

Displays:

* Total Departments
* Total Users
* Total Tasks
* Completed Tasks
* Active Tasks
* System Activity

## Manager Dashboard

Displays:

* Department Statistics
* Employee Performance
* Task Progress
* Workflow Status

## Employee Dashboard

Employees do not have access to analytics dashboards.

After login, employees are redirected to:

* My Tasks
* My Department

---

# Security Policies

Commandix implements multiple security layers.

Features:

* Token Authentication
* Route Protection
* API Authorization
* Department Isolation
* Permission Validation
* Activity Auditing
* File Protection
* Input Validation

---

# Database Tables

Core Tables:

* users
* roles
* permissions
* role_permissions
* departments
* tasks
* task_assignees
* task_mentions
* task_workflows
* task_comments
* attachments
* notifications
* manager_messages
* activity_logs

Enterprise Tables:

* companies
* subscriptions
* audit_logs

---

# API Structure

Base URL:

/api/v1

Modules:

Authentication

/auth/login
/auth/register
/auth/logout
/auth/me

Users

/users

Departments

/departments

Tasks

/tasks

Task Workflows

/task-workflows

Task Comments

/task-comments

Files

/files

Notifications

/notifications

Manager Messages

/messages

Roles

/roles

Permissions

/permissions

Activity Logs

/activity-logs

Dashboard

/dashboard

---

# Multi-Tenant Architecture

The platform is designed to support multiple companies.

Each company has:

* Separate users
* Separate departments
* Separate tasks
* Separate workflows
* Separate files

Data isolation is enforced at the database level.

---

# Future Roadmap

Phase 2

* Mobile Applications
* Team Chat
* Time Tracking
* Attendance Management
* KPI Tracking

Phase 3

* Video Meetings
* Payroll Integration
* HR Module
* Recruitment Module

Phase 4

* Artificial Intelligence Assistant
* Smart Task Suggestions
* Automated Workflow Generation
* Predictive Analytics

---

# Project Vision

Commandix is designed to evolve beyond traditional task management software.

The long-term vision is to provide organizations with a complete operational ecosystem that combines task management, workflow automation, communication, reporting, performance tracking, and enterprise collaboration into a single platform.
