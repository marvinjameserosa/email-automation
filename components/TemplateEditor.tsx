"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Trash2, Edit, Copy, FolderOpen, Bold, Italic, Underline, Link, List, ListOrdered, Plus } from 'lucide-react';

type Template = {
	id: string;
	name: string;
	subject: string;
	message: string;
	createdAt: number;
	filename?: string; 
};

type ContextMenu = {
	x: number;
	y: number;
	templateId: string;
} | null;

export default function TemplateEditor() {
	const [subject, setSubject] = useState('Subject');
	const [message, setMessage] = useState('Pick a template / Make a message');
	const [previewOpen, setPreviewOpen] = useState(false);
	const [templates, setTemplates] = useState<Template[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [contextMenu, setContextMenu] = useState<ContextMenu>(null);
	const [isEditingInPreview, setIsEditingInPreview] = useState(false);
	const [previewSubject, setPreviewSubject] = useState('');
	const [previewMessage, setPreviewMessage] = useState('');
	const editableRef = useRef<HTMLDivElement>(null);
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [lastSaved, setLastSaved] = useState<Date | null>(null);
	const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const [originalContent, setOriginalContent] = useState<{subject: string, message: string} | null>(null);

	// load templates once on mount
	useEffect(() => {
		async function loadAllTemplates() {
			// Fetch HTML templates from the API
			const htmlTemplates: Template[] = [];
			try {
				const response = await fetch('/api/templates');
				console.log('Fetch API response:', response.status, response.ok);
				
				if (response.ok) {
					const data = await response.json();
					console.log('Loaded templates from API:', data.templates.length);
					
					// Map API templates to our format
					data.templates.forEach((t: any) => {
						htmlTemplates.push({
							id: t.id,
							name: t.name,
							subject: t.subject,
							message: t.message,
							createdAt: Date.now(),
							filename: t.filename
						});
					});
				} else {
					console.error('Failed to fetch templates:', response.status);
				}
			} catch (error) {
				console.error('Failed to load HTML templates:', error);
			}
			
			console.log('Total templates loaded:', htmlTemplates.length);
			
			if (htmlTemplates.length) {
				setTemplates(htmlTemplates);
				setSelectedId(htmlTemplates[0].id);
				setSubject(htmlTemplates[0].subject || 'Subject');
				setMessage(htmlTemplates[0].message || 'Pick a template / Make a message');
				// Store original content when initially loading
				setOriginalContent({ 
					subject: htmlTemplates[0].subject || 'Subject', 
					message: htmlTemplates[0].message || 'Pick a template / Make a message' 
				});
			}
		}
		
		loadAllTemplates();
	}, []);

	// Close context menu when clicking anywhere
	useEffect(() => {
		const handleClick = () => setContextMenu(null);
		document.addEventListener('click', handleClick);
		return () => document.removeEventListener('click', handleClick);
	}, []);

	// Autosave functionality - triggers 2 seconds after user stops typing
	useEffect(() => {
		// Don't autosave if no template is selected or if saving is in progress
		if (!selectedId || isSaving) return;

		// Check if content has actually changed
		if (originalContent && 
			originalContent.subject === subject && 
			originalContent.message === message) {
			return; // No changes, don't autosave
		}

		// Clear existing timeout
		if (autoSaveTimeoutRef.current) {
			clearTimeout(autoSaveTimeoutRef.current);
		}

		// Set new timeout for autosave (2 seconds after last change)
		autoSaveTimeoutRef.current = setTimeout(() => {
			autoSaveCurrentTemplate();
		}, 2000);

		// Cleanup timeout on unmount or when dependencies change
		return () => {
			if (autoSaveTimeoutRef.current) {
				clearTimeout(autoSaveTimeoutRef.current);
			}
		};
	}, [subject, message, selectedId, isSaving]);

	// Autosave function
	function autoSaveCurrentTemplate() {
		if (!selectedId) return;
		
		const currentTemplate = templates.find(t => t.id === selectedId);
		if (!currentTemplate?.filename) return;

		setIsSaving(true);
		
		// Delete old file and create new one with same name
		fetch(`/api/templates?filename=${currentTemplate.filename}`, {
			method: 'DELETE'
		})
		.then(() => {
			return fetch('/api/templates', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ 
					name: currentTemplate.name, 
					subject, 
					message 
				})
			});
		})
		.then(res => res.json())
		.then(data => {
			if (data.success) {
				setLastSaved(new Date());
				// Update original content to reflect the saved state
				setOriginalContent({ subject, message });
				return fetch('/api/templates');
			} else {
				throw new Error(data.error || 'Failed to autosave');
			}
		})
		.then(res => res.json())
		.then(data => {
			const newTemplates: Template[] = data.templates.map((t: any) => ({
				id: t.id,
				name: t.name,
				subject: t.subject,
				message: t.message,
				createdAt: Date.now(),
				filename: t.filename
			}));
			setTemplates(newTemplates);
		})
		.catch(error => {
			console.error('Error autosaving template:', error);
		})
		.finally(() => {
			setIsSaving(false);
		});
	}

	const currentMessage = isEditingInPreview ? previewMessage : message;
	
	// Check if message contains full HTML document (not just HTML tags)
	const isHtmlTemplate = currentMessage.trim().startsWith('<!DOCTYPE') || currentMessage.trim().startsWith('<html');

	// Check if there are unsaved changes
	const hasUnsavedChanges = originalContent && 
		(originalContent.subject !== subject || originalContent.message !== message);

	function createNewTemplate() {
		setSelectedId(null);
		setSubject('Subject');
		setMessage('Pick a template / Make a message');
		setOriginalContent(null); // Clear original content for new template
	}

	function saveAsNew(name?: string) {
		const templateName = name ?? prompt('Enter template name:', `Template ${templates.length + 1}`);
		if (!templateName) return;
		
		setIsSaving(true);
		
		// Save to API
		fetch('/api/templates', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: templateName, subject, message })
		})
		.then(res => res.json())
		.then(data => {
			if (data.success) {
				console.log('Template saved:', data.filename);
				// Reload templates from API
				return fetch('/api/templates');
			} else {
				throw new Error(data.error || 'Failed to save');
			}
		})
		.then(res => res.json())
		.then(data => {
			const newTemplates: Template[] = data.templates.map((t: any) => ({
				id: t.id,
				name: t.name,
				subject: t.subject,
				message: t.message,
				createdAt: Date.now(),
				filename: t.filename
			}));
			setTemplates(newTemplates);
			
			// Select the newly created template
			const newTemplate = newTemplates.find(t => t.name.toLowerCase().includes(templateName.toLowerCase()));
			if (newTemplate) {
				setSelectedId(newTemplate.id);
			}
		})
		.catch(error => {
			console.error('Error saving template:', error);
			alert('Failed to save template: ' + error.message);
		})
		.finally(() => {
			setIsSaving(false);
		});
	}

	function loadTemplate(id: string) {
		const t = templates.find((x) => x.id === id);
		if (!t) return;
		setSelectedId(id);
		setSubject(t.subject);
		setMessage(t.message);
		// Store original content when loading a template
		setOriginalContent({ subject: t.subject, message: t.message });
	}

	function deleteTemplate(id: string) {
		const templateToDelete = templates.find(t => t.id === id);
		
		if (!window.confirm('Delete this template?')) return;
		
		if (!templateToDelete?.filename) return;
		
		// Delete from API
		fetch(`/api/templates?filename=${templateToDelete.filename}`, {
			method: 'DELETE'
		})
		.then(res => res.json())
		.then(data => {
			if (data.success) {
				console.log('Template deleted');
				// Reload templates
				return fetch('/api/templates');
			} else {
				throw new Error(data.error || 'Failed to delete');
			}
		})
		.then(res => res.json())
		.then(data => {
			const newTemplates: Template[] = data.templates.map((t: any) => ({
				id: t.id,
				name: t.name,
				subject: t.subject,
				message: t.message,
				createdAt: Date.now(),
				filename: t.filename
			}));
			setTemplates(newTemplates);
			
			if (selectedId === id) {
				if (newTemplates.length) {
					loadTemplate(newTemplates[0].id);
				} else {
					createNewTemplate();
				}
			}
		})
		.catch(error => {
			console.error('Error deleting template:', error);
			alert('Failed to delete template: ' + error.message);
		});
	}

	function renameTemplate(id: string) {
		const templateToRename = templates.find(t => t.id === id);
		if (!templateToRename) return;
		
		const newName = prompt('Rename template', templateToRename.name);
		if (!newName || newName === templateToRename.name) return;
		
		// Delete old and create new with updated name
		fetch(`/api/templates?filename=${templateToRename.filename}`, {
			method: 'DELETE'
		})
		.then(() => {
			return fetch('/api/templates', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ 
					name: newName, 
					subject: templateToRename.subject, 
					message: templateToRename.message 
				})
			});
		})
		.then(res => res.json())
		.then(data => {
			if (data.success) {
				// Reload templates
				return fetch('/api/templates');
			} else {
				throw new Error(data.error || 'Failed to rename');
			}
		})
		.then(res => res.json())
		.then(data => {
			const newTemplates: Template[] = data.templates.map((t: any) => ({
				id: t.id,
				name: t.name,
				subject: t.subject,
				message: t.message,
				createdAt: Date.now(),
				filename: t.filename
			}));
			setTemplates(newTemplates);
			
			// Select the renamed template
			const renamedTemplate = newTemplates.find(t => t.name === newName);
			if (renamedTemplate && selectedId === id) {
				setSelectedId(renamedTemplate.id);
			}
		})
		.catch(error => {
			console.error('Error renaming template:', error);
			alert('Failed to rename template: ' + error.message);
		});
	}

	function duplicateTemplate(id: string) {
		const templateToDuplicate = templates.find(t => t.id === id);
		if (!templateToDuplicate) return;
		
		const newName = prompt('Enter name for duplicate:', `${templateToDuplicate.name} (Copy)`);
		if (!newName) return;
		
		// Create new template with same content
		fetch('/api/templates', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ 
				name: newName, 
				subject: templateToDuplicate.subject, 
				message: templateToDuplicate.message 
			})
		})
		.then(res => res.json())
		.then(data => {
			if (data.success) {
				return fetch('/api/templates');
			} else {
				throw new Error(data.error || 'Failed to duplicate');
			}
		})
		.then(res => res.json())
		.then(data => {
			const newTemplates: Template[] = data.templates.map((t: any) => ({
				id: t.id,
				name: t.name,
				subject: t.subject,
				message: t.message,
				createdAt: Date.now(),
				filename: t.filename
			}));
			setTemplates(newTemplates);
			
			// Select the duplicated template
			const duplicatedTemplate = newTemplates.find(t => t.name === newName);
			if (duplicatedTemplate) {
				setSelectedId(duplicatedTemplate.id);
			}
		})
		.catch(error => {
			console.error('Error duplicating template:', error);
			alert('Failed to duplicate template: ' + error.message);
		});
	}

	function handleContextMenu(e: React.MouseEvent, templateId: string) {
		e.preventDefault();
		setContextMenu({
			x: e.clientX,
			y: e.clientY,
			templateId
		});
	}

	function applyFormatting(command: string, value?: string) {
		if (isHtmlTemplate && iframeRef.current) {
			// Apply formatting to iframe content
			const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
			if (iframeDoc) {
				iframeDoc.execCommand(command, false, value);
			}
		} else {
			// Apply formatting to content editable div
			document.execCommand(command, false, value);
			editableRef.current?.focus();
		}
	}

	function handleEditInPreview() {
		if (isEditingInPreview) {
			// Save changes back to main editor
			if (isHtmlTemplate && iframeRef.current) {
				// For HTML templates, get content from iframe
				const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
				if (iframeDoc) {
					const htmlContent = iframeDoc.documentElement.outerHTML;
					setMessage(htmlContent);
				}
			} else {
				// For simple templates, get content from content editable div
				const htmlContent = editableRef.current?.innerHTML || '';
				setMessage(htmlContent);
			}
			setSubject(previewSubject);
		} else {
			// Enter edit mode - copy current values
			setPreviewSubject(subject);
			setPreviewMessage(message);
			
			// If HTML template, make iframe editable after it loads
			if (isHtmlTemplate) {
				setTimeout(() => {
					if (iframeRef.current) {
						const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
						if (iframeDoc && iframeDoc.body) {
							iframeDoc.designMode = 'on';
							// Add some styling to indicate it's editable
							iframeDoc.body.style.cursor = 'text';
						}
					}
				}, 100);
			}
		}
		setIsEditingInPreview(!isEditingInPreview);
	}

	return (
		<div className="max-w-6xl mx-auto p-6">
			<div className="grid grid-cols-1 md:grid-cols-4 gap-6">
				{/* sidebar */}
				<aside className="md:col-span-1 bg-white border border-gray-100 rounded-lg p-4 shadow-sm">
					<div className="flex items-center justify-between mb-4">
						<h3 className="text-sm font-semibold">Templates</h3>
						<button
							onClick={() => { createNewTemplate(); setSelectedId(null); }}
							className="p-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer transition-colors"
							title="Create Template"
						>
							<Plus size={18} />
						</button>
					</div>

					<div className="flex flex-col gap-2 max-h-[40vh] overflow-auto">
						{templates.length === 0 && (
							<div className="text-sm text-gray-500">No saved templates yet. Create one and click "Save as new".</div>
						)}
						{templates.map((t) => (
							<div 
								key={t.id} 
								className={`p-2 rounded-md cursor-pointer ${t.id === selectedId ? 'bg-primary/5 border border-primary/20' : 'hover:bg-gray-50'}`}
								onClick={() => loadTemplate(t.id)}
								onContextMenu={(e) => handleContextMenu(e, t.id)}
							>
								<div className="text-sm font-medium truncate">{t.name}</div>
								<div className="text-xs text-gray-500 truncate">{t.subject}</div>
							</div>
						))}
					</div>
				</aside>

				{/* editor area */}
				<section className="md:col-span-3 bg-white border border-gray-100 rounded-lg p-6 shadow-sm">
					<div className="flex items-center justify-between mb-4">
						<div>
							<h2 className="text-2xl font-semibold">Template Editor</h2>
							<p className="text-sm text-gray-500">
								Create and preview the email template that will be sent to recipients.
								{selectedId && (
									<span className="ml-2 text-xs">
										{isSaving ? (
											<span className="text-blue-600">● Saving...</span>
										) : hasUnsavedChanges ? (
											<span className="text-amber-600">● Unsaved changes</span>
										) : lastSaved ? (
											<span className="text-green-600">● Saved at {lastSaved.toLocaleTimeString()}</span>
										) : (
											<span className="text-gray-400">● Autosave enabled</span>
										)}
									</span>
								)}
							</p>
						</div>
						<div className="flex items-center gap-3">
							<button 
								onClick={() => saveAsNew()} 
								disabled={isSaving}
								className="px-3 py-2 text-sm bg-white border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{isSaving ? 'Saving...' : 'Save as new Template'}
							</button>
						</div>
					</div>

					<div className="grid grid-cols-1 gap-4">
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">Email Subject</label>
							<input
								value={subject}
								onChange={(e) => setSubject(e.target.value)}
								className="w-full p-3 rounded-md border border-gray-200 bg-slate-50 focus:ring-2 focus:ring-primary/40"
							/>
						</div>

						<div>
							<label className="block text-sm font-medium text-gray-700 mb-2">Email Message</label>
							<textarea
								value={message}
								onChange={(e) => setMessage(e.target.value)}
								rows={12}
								className="w-full p-3 rounded-md border border-gray-200 font-mono whitespace-pre-wrap resize-y bg-white/95 focus:ring-2 focus:ring-primary/40"
							/>
						</div>

						<div className="flex items-center justify-between gap-3">
							<div className="flex items-center gap-3">
								<button onClick={() => setPreviewOpen(true)} className="inline-flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">Preview email</button>
								<button className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg cursor-pointer">Use this template</button>
							</div>
							<div className="text-sm text-gray-500">Use <code className="bg-gray-100 px-1 rounded">{'{name}'}</code> as placeholder for recipient name.</div>
						</div>
					</div>

					{previewOpen && (
						<div role="dialog" aria-modal="true" className="fixed inset-0 flex items-center justify-center bg-black/40 z-50" onClick={() => setPreviewOpen(false)}>
							<div onClick={(e) => e.stopPropagation()} className="w-[min(900px,96%)] max-h-[90vh] overflow-auto bg-white rounded-lg p-5 shadow-lg">
								<div className="flex justify-between items-center mb-3">
									<div>
										<strong className="text-lg">Email preview</strong>
										<div className="text-sm text-gray-500">
											{isEditingInPreview ? 'Edit your email visually' : 'How this email will look for the recipient'}
										</div>
									</div>
									<div className="flex items-center gap-2">
										<button 
											onClick={handleEditInPreview} 
											className={`px-3 py-2 text-sm rounded-md ${isEditingInPreview ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
										>
											{isEditingInPreview ? 'Apply Changes' : 'Edit'}
										</button>
										<button onClick={() => {
											setPreviewOpen(false);
											setIsEditingInPreview(false);
										}} className="text-sm text-gray-700 bg-transparent border-0 cursor-pointer">Close</button>
									</div>
								</div>

								<div className="mb-3">
									<div className="text-sm text-gray-500 mb-2">Subject</div>
									{isEditingInPreview ? (
										<input
											value={previewSubject}
											onChange={(e) => setPreviewSubject(e.target.value)}
											className="w-full p-3 rounded-md border border-gray-200 bg-slate-50 focus:ring-2 focus:ring-primary/40"
										/>
									) : (
										<div className="p-3 rounded-md bg-gray-100 border border-gray-200">{subject}</div>
									)}
								</div>

								{/* Formatting toolbar - only show in edit mode */}
								{isEditingInPreview && (
									<div className="mb-3 p-2 bg-gray-50 border border-gray-200 rounded-md flex items-center gap-2 flex-wrap">
										<button
											onClick={() => applyFormatting('bold')}
											className="p-2 hover:bg-gray-200 rounded"
											title="Bold"
											type="button"
										>
											<Bold size={18} />
										</button>
										<button
											onClick={() => applyFormatting('italic')}
											className="p-2 hover:bg-gray-200 rounded"
											title="Italic"
											type="button"
										>
											<Italic size={18} />
										</button>
										<button
											onClick={() => applyFormatting('underline')}
											className="p-2 hover:bg-gray-200 rounded"
											title="Underline"
											type="button"
										>
											<Underline size={18} />
										</button>
										<div className="w-px h-6 bg-gray-300"></div>
										<button
											onClick={() => applyFormatting('insertUnorderedList')}
											className="p-2 hover:bg-gray-200 rounded"
											title="Bullet List"
											type="button"
										>
											<List size={18} />
										</button>
										<button
											onClick={() => applyFormatting('insertOrderedList')}
											className="p-2 hover:bg-gray-200 rounded"
											title="Numbered List"
											type="button"
										>
											<ListOrdered size={18} />
										</button>
										<div className="w-px h-6 bg-gray-300"></div>
										<button
											onClick={() => {
												const url = prompt('Enter link URL:');
												if (url) applyFormatting('createLink', url);
											}}
											className="p-2 hover:bg-gray-200 rounded"
											title="Insert Link"
											type="button"
										>
											<Link size={18} />
										</button>
										<div className="w-px h-6 bg-gray-300"></div>
										<select
											onChange={(e) => applyFormatting('formatBlock', e.target.value)}
											className="p-1 text-sm border border-gray-300 rounded"
											defaultValue=""
										>
											<option value="">Normal</option>
											<option value="h1">Heading 1</option>
											<option value="h2">Heading 2</option>
											<option value="h3">Heading 3</option>
											<option value="p">Paragraph</option>
										</select>
										<select
											onChange={(e) => {
												applyFormatting('fontSize', e.target.value);
											}}
											className="p-1 text-sm border border-gray-300 rounded"
											defaultValue="3"
										>
											<option value="1">Tiny</option>
											<option value="2">Small</option>
											<option value="3">Normal</option>
											<option value="4">Large</option>
											<option value="5">Huge</option>
										</select>
									</div>
								)}

								<div>
									<div className="text-sm text-gray-500 mb-2">Message</div>
									{isEditingInPreview ? (
										isHtmlTemplate ? (
											<div className="border border-gray-200 rounded-md overflow-hidden">
												<iframe
													ref={iframeRef}
													srcDoc={previewMessage}
													className="w-full h-[600px] border-0"
													title="Email Editor"
													sandbox="allow-same-origin allow-scripts"
												/>
											</div>
										) : (
											<div
												ref={editableRef}
												contentEditable
												suppressContentEditableWarning
												dangerouslySetInnerHTML={{ __html: previewMessage }}
												className="w-full min-h-[400px] p-3 rounded-md border border-gray-200 bg-white focus:ring-2 focus:ring-primary/40 focus:outline-none overflow-auto"
												style={{ whiteSpace: 'normal' }}
											/>
										)
									) : isHtmlTemplate ? (
										<div className="border border-gray-200 rounded-md overflow-hidden">
											<iframe
												srcDoc={currentMessage}
												className="w-full h-[600px] border-0"
												title="Email Preview"
												sandbox="allow-same-origin"
											/>
										</div>
									) : (
										<div 
											className="p-3 rounded-md border border-gray-200 overflow-auto"
											dangerouslySetInnerHTML={{ __html: currentMessage }}
										/>
									)}
								</div>
							</div>
						</div>
					)}
				</section>
			</div>

			{/* Context Menu */}
			{contextMenu && (
				<div
					className="fixed bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 min-w-[160px]"
					style={{ top: contextMenu.y, left: contextMenu.x }}
					onClick={(e) => e.stopPropagation()}
				>
					<button
						onClick={() => {
							loadTemplate(contextMenu.templateId);
							setContextMenu(null);
						}}
						className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
					>
						<FolderOpen size={14} />
						Open
					</button>
					<button
						onClick={() => {
							duplicateTemplate(contextMenu.templateId);
							setContextMenu(null);
						}}
						className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
					>
						<Copy size={14} />
						Duplicate
					</button>
					<button
						onClick={() => {
							renameTemplate(contextMenu.templateId);
							setContextMenu(null);
						}}
						className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
					>
						<Edit size={14} />
						Rename
					</button>
					<div className="border-t border-gray-200 my-1"></div>
					<button
						onClick={() => {
							deleteTemplate(contextMenu.templateId);
							setContextMenu(null);
						}}
						className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
					>
						<Trash2 size={14} />
						Delete
					</button>
				</div>
			)}
		</div>
	);
}

