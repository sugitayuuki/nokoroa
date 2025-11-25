'use client';

import {
  Add as AddIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  History as HistoryIcon,
  LocationOn as LocationIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';

import { useSearchHistory } from '@/hooks/useSearchHistory';
import { useSearchSuggestions } from '@/hooks/useSearchSuggestions';
import { useTags } from '@/hooks/useTags';
import { getTagColor } from '@/utils/tagColors';

import { SearchFilters } from '../../types/search';

interface SearchFormProps {
  onSearch: (filters: SearchFilters) => void;
  initialFilters?: SearchFilters;
}

export const SearchForm = ({ onSearch, initialFilters }: SearchFormProps) => {
  const [query, setQuery] = useState(initialFilters?.q || '');
  const [tags, setTags] = useState<string[]>(initialFilters?.tags || []);
  const [location, setLocation] = useState(initialFilters?.location || '');
  const [tagInputValue, setTagInputValue] = useState('');
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(
    !!(initialFilters?.tags?.length || initialFilters?.location),
  );

  // タグ候補を取得
  const { tags: availableTags } = useTags();
  const tagOptions = availableTags.map((tag) => tag.name);

  // キーワードと場所のサジェスト
  const {
    suggestions: keywordSuggestions,
    isLoading: keywordLoading,
    getSuggestions: getKeywordSuggestions,
  } = useSearchSuggestions('keyword');

  const {
    suggestions: locationSuggestions,
    isLoading: locationLoading,
    getSuggestions: getLocationSuggestions,
  } = useSearchSuggestions('location');

  // 検索履歴
  const {
    history: keywordHistory,
    addToHistory: addKeywordToHistory,
    removeFromHistory: removeKeywordFromHistory,
  } = useSearchHistory('keyword');

  const {
    history: locationHistory,
    addToHistory: addLocationToHistory,
    removeFromHistory: removeLocationFromHistory,
  } = useSearchHistory('location');

  // キーワード入力時のサジェスト取得
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length > 0) {
        getKeywordSuggestions(query);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  // 場所入力時のサジェスト取得
  useEffect(() => {
    const timer = setTimeout(() => {
      if (location.length > 0) {
        getLocationSuggestions(location);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [location]); // eslint-disable-line react-hooks/exhaustive-deps

  // キーワード候補リストを生成（重複を除去）
  const keywordOptions = [
    ...keywordHistory.map((item) => ({
      type: 'history' as const,
      value: item,
    })),
    ...keywordSuggestions
      .filter((item) => !keywordHistory.includes(item))
      .map((item) => ({ type: 'suggestion' as const, value: item })),
  ];

  // 場所候補リストを生成（重複を除去）
  const locationOptions = [
    ...locationHistory.map((item) => ({
      type: 'history' as const,
      value: item,
    })),
    ...locationSuggestions
      .filter((item) => !locationHistory.includes(item))
      .map((item) => ({ type: 'suggestion' as const, value: item })),
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 検索履歴に追加
    if (query.trim()) {
      addKeywordToHistory(query.trim());
    }
    if (location.trim()) {
      addLocationToHistory(location.trim());
    }

    const filters: SearchFilters = {
      q: query.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
      location: location.trim() || undefined,
      limit: 10,
      offset: 0,
    };

    onSearch(filters);
  };

  const handleAddTag = (value: string) => {
    if (value && value.trim() && !tags.includes(value.trim())) {
      setTags([...tags, value.trim()]);
      setTagInputValue('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleTagChange = (
    _event: React.SyntheticEvent,
    newValue: string | null,
  ) => {
    if (newValue) {
      handleAddTag(newValue);
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <form onSubmit={handleSubmit}>
        <Box sx={{ mb: 3 }}>
          <Autocomplete
            freeSolo
            options={keywordOptions}
            value={query}
            onInputChange={(_event, newValue) => setQuery(newValue)}
            onChange={(_event, newValue) => {
              if (typeof newValue === 'string') {
                setQuery(newValue);
              } else if (newValue && typeof newValue === 'object') {
                setQuery(newValue.value);
              }
            }}
            getOptionLabel={(option) => {
              if (typeof option === 'string') return option;
              return option.value;
            }}
            getOptionKey={(option) => {
              if (typeof option === 'string') return option;
              return `${option.type}-${option.value}`;
            }}
            renderOption={(props, option) => {
              const { key, ...restProps } = props;
              return (
                <li key={key} {...restProps}>
                  <ListItemIcon>
                    {typeof option === 'object' && option.type === 'history' ? (
                      <HistoryIcon fontSize="small" />
                    ) : (
                      <SearchIcon fontSize="small" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={typeof option === 'string' ? option : option.value}
                  />
                  {typeof option === 'object' && option.type === 'history' && (
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeKeywordFromHistory(option.value);
                      }}
                    >
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  )}
                </li>
              );
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                fullWidth
                label="キーワード検索"
                placeholder="タイトル、コンテンツ、著者名で検索..."
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <>
                      {keywordLoading && (
                        <CircularProgress color="inherit" size={20} />
                      )}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            loading={keywordLoading}
          />
        </Box>

        <Accordion
          expanded={isAdvancedOpen}
          onChange={() => setIsAdvancedOpen(!isAdvancedOpen)}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>詳細検索</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Autocomplete
                  freeSolo
                  options={locationOptions}
                  value={location}
                  onInputChange={(_event, newValue) => setLocation(newValue)}
                  onChange={(_event, newValue) => {
                    if (typeof newValue === 'string') {
                      setLocation(newValue);
                    } else if (newValue && typeof newValue === 'object') {
                      setLocation(newValue.value);
                    }
                  }}
                  getOptionLabel={(option) => {
                    if (typeof option === 'string') return option;
                    return option.value;
                  }}
                  getOptionKey={(option) => {
                    if (typeof option === 'string') return option;
                    return `${option.type}-${option.value}`;
                  }}
                  renderOption={(props, option) => {
                    const { key, ...restProps } = props;
                    return (
                      <li key={key} {...restProps}>
                        <ListItemIcon>
                          {typeof option === 'object' &&
                          option.type === 'history' ? (
                            <HistoryIcon fontSize="small" />
                          ) : (
                            <LocationIcon fontSize="small" />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            typeof option === 'string' ? option : option.value
                          }
                        />
                        {typeof option === 'object' &&
                          option.type === 'history' && (
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeLocationFromHistory(option.value);
                              }}
                            >
                              <ClearIcon fontSize="small" />
                            </IconButton>
                          )}
                      </li>
                    );
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      fullWidth
                      label="場所"
                      placeholder="場所で絞り込み..."
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <InputAdornment position="start">
                            <LocationIcon />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <>
                            {locationLoading && (
                              <CircularProgress color="inherit" size={20} />
                            )}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  loading={locationLoading}
                  sx={{ flex: 1, minWidth: 200 }}
                />
                <Autocomplete
                  fullWidth
                  options={tagOptions.filter((tag) => !tags.includes(tag))}
                  value={null}
                  inputValue={tagInputValue}
                  onInputChange={(_event, newInputValue) => {
                    setTagInputValue(newInputValue);
                  }}
                  onChange={handleTagChange}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="タグを追加"
                      placeholder="タグを入力または選択"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {params.InputProps.endAdornment}
                            {tagInputValue && (
                              <InputAdornment position="end">
                                <IconButton
                                  onClick={() => handleAddTag(tagInputValue)}
                                  edge="end"
                                  size="small"
                                >
                                  <AddIcon />
                                </IconButton>
                              </InputAdornment>
                            )}
                          </>
                        ),
                      }}
                    />
                  )}
                  freeSolo
                  clearOnEscape
                  blurOnSelect
                  sx={{ flex: 1, minWidth: 200 }}
                />
              </Box>
              {tags.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    選択されたタグ:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {tags.map((tag) => (
                      <Chip
                        key={tag}
                        label={tag.startsWith('#') ? tag : `#${tag}`}
                        onDelete={() => handleRemoveTag(tag)}
                        sx={{
                          backgroundColor: getTagColor(tag),
                          color: 'white',
                          '& .MuiChip-deleteIcon': {
                            color: 'rgba(255, 255, 255, 0.7)',
                            '&:hover': {
                              color: 'white',
                            },
                          },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            type="submit"
            variant="contained"
            size="large"
            startIcon={<SearchIcon />}
          >
            検索
          </Button>
        </Box>
      </form>
    </Paper>
  );
};
