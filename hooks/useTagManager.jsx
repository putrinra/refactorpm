import { useEffect, useMemo, useState } from 'react'
import { message } from 'antd'
import { loadProjectDevices, saveProjectDevices } from '../projectStorage.js'
import { connectProjectStream, deleteProjectTag, fetchProjectDevices, upsertProjectTag } from '../../../api/projectApi.js'

const emptyTagForm = {
  name: '',
  type: 'analog',
  description: 'Analog Input',
  address: '',
  logData: 'yes',
}

export function useTagManager(deviceId) {
  const [devices, setDevices] = useState(() => loadProjectDevices())
  const [selectedTagIds, setSelectedTagIds] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTagTab, setActiveTagTab] = useState('all')
  const [isTagModalOpen, setIsTagModalOpen] = useState(false)
  const [tagModalMode, setTagModalMode] = useState('add')
  const [tagForm, setTagForm] = useState(emptyTagForm)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [time, setTime] = useState('')
  const [dataSource, setDataSource] = useState('dummy')
  const [backendStatus, setBackendStatus] = useState('')

  function applyBackendDevices(response) {
    const apiDevices = Array.isArray(response?.devices) ? response.devices : []
    const nextSource = response?.source === 'mqtt' ? 'mqtt' : 'dummy'
    setDataSource(nextSource)
    setBackendStatus(response?.status?.message || '')
    if (nextSource === 'mqtt') {
      setDevices(apiDevices)
    }
  }

  const activeDevice = useMemo(
    () => devices.find((device) => String(device.id) === String(deviceId)) ?? null,
    [devices, deviceId],
  )

  const tagRows = useMemo(() => {
    if (!activeDevice) return []
    const typeFilteredTags = activeTagTab === 'all'
      ? activeDevice.tags
      : activeDevice.tags.filter((tag) => tag.type === activeTagTab)

    const keyword = searchTerm.trim().toLowerCase()
    if (!keyword) return typeFilteredTags

    return typeFilteredTags.filter((tag) => tag.name.toLowerCase().includes(keyword))
  }, [activeDevice, activeTagTab, searchTerm])

  const selectedTag = activeDevice?.tags.find((tag) => tag.id === selectedTagIds[0]) ?? null
  const canEdit = selectedTagIds.length === 1
  const canDelete = selectedTagIds.length > 0
  const analogCount = activeDevice?.tags.filter((row) => row.type === 'analog').length ?? 0
  const discreteCount = activeDevice?.tags.filter((row) => row.type === 'discrete').length ?? 0
  const textCount = activeDevice?.tags.filter((row) => row.type === 'text').length ?? 0

  useEffect(() => {
    if (dataSource !== 'mqtt') saveProjectDevices(devices)
  }, [devices, dataSource])

  useEffect(() => {
    let isMounted = true
    fetchProjectDevices()
      .then((response) => { if (isMounted) applyBackendDevices(response) })
      .catch(() => { if (isMounted) setDataSource('dummy') })
    return () => { isMounted = false }
  }, [])

  useEffect(() => {
    const stream = connectProjectStream((response) => applyBackendDevices(response))
    return () => stream.close()
  }, [])

  useEffect(() => { setSelectedTagIds([]) }, [deviceId, activeTagTab])

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date()
      const options = { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }
      setTime(now.toLocaleString('en-GB', options).replace(',', ''))
    }
    updateDateTime()
    const timer = setInterval(updateDateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  function toggleTagSelection(tagId) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    )
  }

  function openAddTagModal() {
    setTagModalMode('add')
    setTagForm(emptyTagForm)
    setIsTagModalOpen(true)
  }

  function openEditTagModal() {
    if (!selectedTag) return
    setTagModalMode('edit')
    setTagForm({
      name: selectedTag.name, type: selectedTag.type, description: selectedTag.description,
      address: selectedTag.address, logData: selectedTag.logData || 'yes',
    })
    setIsTagModalOpen(true)
  }

  function closeTagModal() { setIsTagModalOpen(false) }

  function handleTagFieldChange(field, value) {
    setTagForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleTagSubmit(event) {
    event.preventDefault()
    if (!activeDevice) return

    if (dataSource === 'mqtt') {
      upsertProjectTag(activeDevice.name, tagForm, tagModalMode === 'edit' ? selectedTag?.address : '')
        .then(() => {
          setIsTagModalOpen(false)
          setSelectedTagIds([])
          message.success(tagModalMode === 'add' ? 'Tag configuration added.' : 'Tag configuration updated.')
        })
        .catch((error) => message.error(error?.response?.data?.detail || 'Failed to save tag configuration.'))
      return
    }

    if (tagModalMode === 'add') {
      const nextTagId = devices.flatMap((device) => device.tags || []).length
        ? Math.max(...devices.flatMap((device) => device.tags || []).map((tag) => tag.id)) + 1 : 1

      setDevices((prev) => prev.map((device) =>
        device.id === activeDevice.id
          ? { ...device, tags: [...device.tags, { ...tagForm, id: nextTagId, name: tagForm.name || `Tag ${nextTagId}`, address: tagForm.address || '40001' }] }
          : device
      ))
    } else if (selectedTag) {
      setDevices((prev) => prev.map((device) =>
        device.id === activeDevice.id
          ? { ...device, tags: device.tags.map((tag) => tag.id === selectedTag.id ? { ...tag, ...tagForm } : tag) }
          : device
      ))
    }
    setIsTagModalOpen(false)
    setSelectedTagIds([])
  }

  function handleDeleteTags() {
    if (!activeDevice || !selectedTagIds.length) return
    const confirmed = window.confirm(`Delete ${selectedTagIds.length} selected tag(s)?`)
    if (!confirmed) return

    if (dataSource === 'mqtt') {
      const tagsToDelete = activeDevice.tags.filter((tag) => selectedTagIds.includes(tag.id))
      Promise.all(tagsToDelete.map((tag) => deleteProjectTag(activeDevice.name, tag.address)))
        .then(() => {
          setSelectedTagIds([])
          message.success('Tag configuration deleted.')
        })
        .catch((error) => message.error(error?.response?.data?.detail || 'Failed to delete tag configuration.'))
      return
    }

    setDevices((prev) => prev.map((device) =>
      device.id === activeDevice.id ? { ...device, tags: device.tags.filter((tag) => !selectedTagIds.includes(tag.id)) } : device
    ))
    setSelectedTagIds([])
  }

  function getTagTone(tag) {
    if (tag?.matchStatus === 'matched') return 'Matched'
    if (tag?.matchStatus === 'mismatch') return 'Mismatch'
    return 'Waiting'
  }

  return {
    activeDevice, tagRows, selectedTagIds, setSelectedTagIds,
    searchTerm, setSearchTerm, activeTagTab, setActiveTagTab,
    isTagModalOpen, tagModalMode, tagForm, isDarkMode, setIsDarkMode, time,
    canEdit, canDelete, analogCount, discreteCount, textCount,
    toggleTagSelection, openAddTagModal, openEditTagModal, closeTagModal,
    handleTagFieldChange, handleTagSubmit, handleDeleteTags, getTagTone
  }
}